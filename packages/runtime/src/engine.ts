/**
 * The runtime engine: component instances, the persistent node tree,
 * reconciliation and the coalesced frame loop.
 *
 * Model (see docs/architecture notes):
 *  - `factory(props, ctx)` runs ONCE per instance — this is the frontmatter.
 *  - the returned render function runs on mount and whenever the instance is
 *    dirty; its vnode subtree is reconciled against the previous one.
 *  - store subscriptions belong to instances (`ctx.use`/`ctx.watch`); a store
 *    notification marks only its owning instance dirty and schedules one
 *    microtask frame for the whole root.
 *
 * The node tree is renderer-agnostic: elements are plain `{ kind: "element" }`
 * nodes, text is a `{ kind: "text" }` node, and component/fragment nodes are
 * transparent containers that the layout pass walks through.
 */
import { type ComponentType, isComponentType } from "./component.ts";
import type { Ctx, EffectFn } from "./ctx.ts";
import {
  type FocusHandle,
  FocusManager,
  type FocusOptions,
  type KeyHandler,
  type KeyHandlerOptions,
  type KeyInputEvent,
} from "./focus.ts";
import type { KeyEvent } from "@denotui/terminal";
import { isStore, type StoreLike } from "./store.ts";
import { Fragment, h, isVNode, type VNode } from "./vnode.ts";

/** Upper bound on re-render passes inside one frame; catches effect loops. */
const MAX_PASSES = 100;

export interface NodeBase {
  parent: ContainerNode | null;
  /** Distance from the mounted root component; used to render parents first. */
  depth: number;
}

export interface ComponentNode extends NodeBase {
  readonly kind: "component";
  readonly type: ComponentType;
  key: unknown;
  /** The props object handed to the factory. Mutated in place on updates so
   *  render functions observe fresh props without re-running frontmatter. */
  props: Record<string, unknown>;
  /** Raw vnode children (slots), including function children. */
  slots: unknown[];
  children: Node[];
  instance: Instance;
}

export interface ElementNode extends NodeBase {
  readonly kind: "element";
  readonly type: string;
  key: unknown;
  props: Record<string, unknown>;
  children: Node[];
}

export interface TextNode extends NodeBase {
  readonly kind: "text";
  value: string;
}

export interface FragmentNode extends NodeBase {
  readonly kind: "fragment";
  key: unknown;
  children: Node[];
}

export type Node = ComponentNode | ElementNode | TextNode | FragmentNode;
export type ContainerNode = ComponentNode | ElementNode | FragmentNode;

type Phase = "init" | "render" | "commit" | "idle";

interface EffectEntry {
  fn: EffectFn;
  cleanup: (() => void) | null;
}

/**
 * One mounted component. State that survives renders lives here; the generated
 * factory closes over the same props object and its own locals.
 */
export class Instance {
  readonly type: ComponentType;
  readonly root: Root;
  readonly depth: number;
  readonly node: ComponentNode;
  readonly ctx: Ctx;
  render: () => VNode;
  phase: Phase = "init";
  mounted = false;
  dirty = false;
  subscriptions: Map<StoreLike, () => void> = new Map();
  effects: EffectEntry[] = [];
  cleanups: Array<() => void> = [];

  constructor(node: ComponentNode, root: Root, depth: number) {
    this.node = node;
    this.root = root;
    this.type = node.type;
    this.depth = depth;
    this.render = () => h(Fragment, null, []);
    this.ctx = new InstanceCtx(this);
  }

  /**
   * Subscribe once per store; the callback marks only this instance dirty.
   *
   * Subscriptions are released on unmount but not pruned when a read disappears
   * from the render. Accepted v1 tradeoff: an unused subscription costs only a
   * coalesced re-render. See local/PLAN.md "Known tradeoffs / deferred work".
   */
  subscribe(store: StoreLike<unknown>): void {
    if (this.subscriptions.has(store)) return;
    const current = store.get();
    let first = true;
    const unsubscribe = store.subscribe((value) => {
      // Nanostores' `subscribe` fires immediately; ignore that first echo when
      // it reports the value we already have (some store implementations do not
      // fire immediately, in which case a real change must still be delivered).
      if (first) {
        first = false;
        if (Object.is(value, current)) return;
      }
      if (this.mounted) this.root.markDirty(this);
    });
    this.subscriptions.set(store, unsubscribe);
  }

  /** Read a value, subscribing when it is store-shaped. */
  read<T>(value: T): T {
    if (this.phase === "init") {
      throw new Error(
        "denotui: ctx.use()/ctx.expr() cannot read a reactive value while " +
          "frontmatter runs (it executes once and is not re-evaluated). " +
          "Use ctx.watch(store) for a side effect, or read the store in the template.",
      );
    }
    if (!isStore(value)) return value;
    this.subscribe(value);
    return value.get() as T;
  }

  renderSubtree(): void {
    this.phase = "render";
    let vnode: VNode;
    try {
      vnode = this.render();
    } finally {
      this.phase = "idle";
    }
    this.node.children = reconcileValues(
      this.node,
      this.node.children,
      [vnode],
      this.root,
    );
    this.runEffects();
  }

  runEffects(): void {
    this.phase = "commit";
    try {
      for (let i = 0; i < this.effects.length; i++) {
        const entry = this.effects[i];
        entry.cleanup?.();
        entry.cleanup = null;
        const result = entry.fn();
        entry.cleanup = typeof result === "function" ? result : null;
      }
    } finally {
      this.phase = "idle";
    }
  }

  unmount(): void {
    if (!this.mounted) return;
    this.mounted = false;
    this.root.forget(this);
    this.root.focus.unregister(this);
    for (const child of this.node.children) unmountNode(child);
    this.node.children = [];
    for (const unsubscribe of this.subscriptions.values()) unsubscribe();
    this.subscriptions.clear();
    for (const entry of this.effects) entry.cleanup?.();
    this.effects = [];
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
  }
}

class InstanceCtx implements Ctx {
  readonly instance: Instance;

  constructor(instance: Instance) {
    this.instance = instance;
  }

  focus(options?: FocusOptions): FocusHandle {
    this.#assertInit("ctx.focus()");
    return this.instance.root.focus.register(this.instance, options);
  }

  onKey(
    handler: KeyHandler,
    options?: KeyHandlerOptions,
  ): () => void {
    this.#assertInit("ctx.onKey()");
    return this.instance.root.focus.addHandler(
      this.instance,
      handler,
      options?.global === true,
    );
  }

  #assertInit(name: string): void {
    if (this.instance.phase !== "init") {
      throw new Error(
        `${name} must be called in frontmatter; it registers once per instance`,
      );
    }
  }

  use<T>(value: StoreLike<T>): T;
  use<T>(value: T): T;
  use(value: unknown): unknown {
    return this.instance.read(value);
  }

  expr<T>(evaluate: () => StoreLike<T>): T;
  expr<T>(evaluate: () => T): T;
  expr(evaluate: () => unknown): unknown {
    return this.instance.read(evaluate());
  }

  watch(store: StoreLike<unknown>): void {
    if (!isStore(store)) {
      throw new TypeError(
        "denotui: ctx.watch() expects a store (get + subscribe)",
      );
    }
    this.instance.subscribe(store);
  }

  effect(fn: EffectFn): void {
    this.instance.effects.push({ fn, cleanup: null });
  }

  onCleanup(fn: () => void): void {
    this.instance.cleanups.push(fn);
  }
}

/**
 * A mounted application. Owns the document tree, the dirty set, and frame
 * coalescing. Renderers subscribe with {@link Root.onCommit}.
 */
export class Root {
  readonly focus: FocusManager;
  readonly document: FragmentNode = {
    kind: "fragment",
    key: null,
    children: [],
    parent: null,
    depth: -1,
  };
  #mounted: ComponentNode | null = null;
  #dirty = new Set<Instance>();
  #scheduled = false;
  #flushing = false;
  #listeners = new Set<(document: FragmentNode) => void>();

  constructor() {
    this.focus = new FocusManager((instance) => this.markDirty(instance));
  }

  get mounted(): ComponentNode | null {
    return this.#mounted;
  }

  /**
   * Route a key through focused handlers, global handlers and Tab traversal.
   * The application handler runs afterwards, unless propagation was stopped.
   */
  dispatchKey(event: KeyEvent): KeyInputEvent {
    const wrapped = this.focus.dispatch(event);
    if (
      !wrapped.propagationStopped && !wrapped.defaultPrevented &&
      wrapped.name === "tab"
    ) {
      this.focus.move(wrapped.shift ? -1 : 1);
    }
    return wrapped;
  }

  mount(type: ComponentType, props: Record<string, unknown> = {}): void {
    if (this.#mounted) {
      throw new Error("denotui: root is already mounted; unmount it first");
    }
    const children = reconcileValues(
      this.document,
      [],
      [h(type, props, [])],
      this,
    );
    const node = children[0];
    if (!node || node.kind !== "component") {
      throw new TypeError("denotui: root.mount() requires a component");
    }
    this.document.children = children;
    this.#mounted = node;
    this.flush();
    this.#notify();
  }

  unmount(): void {
    if (!this.#mounted) return;
    unmountNode(this.#mounted);
    this.document.children = [];
    this.#mounted = null;
    this.#dirty.clear();
    this.#notify();
  }

  /** Register a renderer callback; it fires after every committed frame. */
  onCommit(listener: (document: FragmentNode) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  markDirty(instance: Instance): void {
    if (!instance.mounted) return;
    instance.dirty = true;
    this.#dirty.add(instance);
    this.#schedule();
  }

  forget(instance: Instance): void {
    instance.dirty = false;
    this.#dirty.delete(instance);
  }

  #schedule(): void {
    if (this.#scheduled || this.#flushing) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.flush();
    });
  }

  /** Run pending updates synchronously. Called automatically on a microtask. */
  flush(): void {
    if (this.#flushing) return;
    this.#scheduled = false;
    this.#flushing = true;
    let changed = false;
    try {
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        if (this.#dirty.size === 0) break;
        const pending = [...this.#dirty];
        this.#dirty.clear();
        for (const instance of pending) instance.dirty = false;
        pending.sort((a, b) => a.depth - b.depth);
        let rendered = 0;
        for (const instance of pending) {
          if (!instance.mounted) continue;
          instance.renderSubtree();
          rendered++;
        }
        changed = changed || rendered > 0;
        if (rendered === 0) break;
      }
      if (this.#dirty.size > 0) {
        this.#dirty.clear();
        throw new Error(
          `denotui: maximum update depth exceeded (${MAX_PASSES} passes)`,
        );
      }
    } finally {
      this.#flushing = false;
    }
    if (changed) this.#notify();
  }

  #notify(): void {
    for (const listener of this.#listeners) listener(this.document);
  }
}

export function createRoot(): Root {
  return new Root();
}

interface TextEntry {
  kind: "text";
  value: string;
}

interface VNodeEntry {
  kind: "vnode";
  vnode: VNode;
}

type Entry = TextEntry | VNodeEntry;

function normalizeChildren(values: unknown[]): Entry[] {
  const entries: Entry[] = [];
  const visit = (value: unknown): void => {
    if (value === null || value === undefined || typeof value === "boolean") {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value === "string") {
      entries.push({ kind: "text", value });
      return;
    }
    if (typeof value === "number" || typeof value === "bigint") {
      entries.push({ kind: "text", value: String(value) });
      return;
    }
    if (isVNode(value)) {
      entries.push({ kind: "vnode", vnode: value });
      return;
    }
    if (isStore(value)) {
      throw new TypeError(
        "denotui: a store reached the node tree. Read it in the template " +
          "(`{$store}` is compiled to `ctx.use($store)`).",
      );
    }
    if (typeof value === "function") {
      throw new TypeError(
        "denotui: function children are only valid on components that " +
          "invoke them (the `Map` pattern); an intrinsic element received one.",
      );
    }
    throw new TypeError(`denotui: invalid child of type ${typeof value}`);
  };
  for (const value of values) visit(value);
  return entries;
}

function nodeKey(node: Node): unknown {
  return node.kind === "text" ? null : node.key ?? null;
}

function canReuse(node: Node, entry: Entry): boolean {
  if (entry.kind === "text") return node.kind === "text";
  const type = entry.vnode.type;
  if (type === Fragment) return node.kind === "fragment";
  if (typeof type === "string") {
    return node.kind === "element" && node.type === type;
  }
  if (isComponentType(type)) {
    return node.kind === "component" && node.type === type;
  }
  return false;
}

function reconcileValues(
  parent: ContainerNode,
  oldNodes: Node[],
  values: unknown[],
  root: Root,
): Node[] {
  const entries = normalizeChildren(values);
  const keyed = new Map<unknown, Node>();
  const unkeyed: Node[] = [];
  for (const old of oldNodes) {
    const key = nodeKey(old);
    if (key === null) unkeyed.push(old);
    else keyed.set(key, old);
  }

  const result: Node[] = [];
  let cursor = 0;

  for (const entry of entries) {
    const key = entry.kind === "vnode" ? entry.vnode.key ?? null : null;
    let old: Node | null = null;

    if (key !== null) {
      const candidate = keyed.get(key);
      if (candidate) {
        keyed.delete(key);
        old = canReuse(candidate, entry) ? candidate : null;
        if (!old) unmountNode(candidate);
      }
    } else if (cursor < unkeyed.length) {
      const candidate = unkeyed[cursor++];
      old = canReuse(candidate, entry) ? candidate : null;
      if (!old) unmountNode(candidate);
    }

    const node = old
      ? updateNode(old, entry, root)
      : mountEntry(parent, entry, root);
    node.parent = parent;
    result.push(node);
  }

  for (const leftover of keyed.values()) unmountNode(leftover);
  while (cursor < unkeyed.length) unmountNode(unkeyed[cursor++]);

  return result;
}

function mountEntry(
  parent: ContainerNode,
  entry: Entry,
  root: Root,
): Node {
  if (entry.kind === "text") {
    return {
      kind: "text",
      value: entry.value,
      parent,
      depth: parent.depth,
    };
  }
  return mountVNode(parent, entry.vnode, root);
}

function updateNode(node: Node, entry: Entry, root: Root): Node {
  if (entry.kind === "text") {
    if (node.kind !== "text") {
      throw new Error("denotui: internal reconcile error (text reuse)");
    }
    node.value = entry.value;
    return node;
  }

  const vnode = entry.vnode;
  if (node.kind === "component") {
    const nextProps = { ...vnode.props, children: vnode.children };
    if (!propsEqual(node.props, nextProps)) {
      replaceProps(node.props, nextProps);
      root.markDirty(node.instance);
    }
    node.key = vnode.key;
    node.slots = vnode.children;
    return node;
  }
  if (node.kind === "element") {
    node.key = vnode.key;
    node.props = { ...vnode.props };
    node.children = reconcileValues(node, node.children, vnode.children, root);
    return node;
  }
  if (node.kind === "fragment") {
    node.key = vnode.key;
    node.children = reconcileValues(node, node.children, vnode.children, root);
    return node;
  }
  throw new Error("denotui: internal reconcile error (text vs vnode)");
}

function mountVNode(
  parent: ContainerNode,
  vnode: VNode,
  root: Root,
): Node {
  const depth = parent.depth;
  if (vnode.type === Fragment) {
    const node: FragmentNode = {
      kind: "fragment",
      key: vnode.key,
      children: [],
      parent,
      depth,
    };
    node.children = reconcileValues(node, [], vnode.children, root);
    return node;
  }
  if (typeof vnode.type === "string") {
    const node: ElementNode = {
      kind: "element",
      type: vnode.type,
      key: vnode.key,
      props: { ...vnode.props },
      children: [],
      parent,
      depth,
    };
    node.children = reconcileValues(node, [], vnode.children, root);
    return node;
  }
  if (isComponentType(vnode.type)) {
    return mountComponent(parent, vnode, root);
  }
  throw new TypeError(
    `denotui: expected a component, intrinsic tag or Fragment; got ${
      String(vnode.type)
    }`,
  );
}

function mountComponent(
  parent: ContainerNode,
  vnode: VNode,
  root: Root,
): ComponentNode {
  const type = vnode.type as ComponentType;
  const depth = parent.depth + 1;
  // One stable props object per instance: frontmatter closes over it, and later
  // updates mutate it in place so render functions see current values.
  const props: Record<string, unknown> = {
    ...vnode.props,
    children: vnode.children,
  };
  const node: ComponentNode = {
    kind: "component",
    type,
    key: vnode.key,
    props,
    slots: vnode.children,
    children: [],
    parent,
    depth,
    instance: null as unknown as Instance,
  };
  const instance = new Instance(node, root, depth);
  node.instance = instance;
  instance.render = type.factory(props, instance.ctx);
  instance.phase = "idle";
  instance.mounted = true;
  instance.renderSubtree();
  return node;
}

function unmountNode(node: Node): void {
  if (node.kind === "component") {
    node.instance.unmount();
    return;
  }
  if (node.kind === "element" || node.kind === "fragment") {
    for (const child of node.children) unmountNode(child);
    node.children = [];
  }
}

function propsEqual(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): boolean {
  const currentKeys = Object.keys(current);
  if (currentKeys.length !== Object.keys(next).length) return false;
  for (const key of currentKeys) {
    if (!(key in next)) return false;
    if (key === "children") {
      if (!shallowArrayEqual(current[key], next[key])) return false;
      continue;
    }
    if (!Object.is(current[key], next[key])) return false;
  }
  return true;
}

function shallowArrayEqual(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

function replaceProps(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  for (const key of Object.keys(target)) {
    if (!(key in source)) delete target[key];
  }
  for (const key of Object.keys(source)) target[key] = source[key];
}
