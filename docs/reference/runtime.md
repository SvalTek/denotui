# Runtime Reference

Public surface comes from two places:

- `@denotui/deno-tui` — application barrel (runtime, components, layout,
  terminal); generated modules import this.
- `@denotui/runtime` — runtime only, for subset imports.

## Primitives

```ts
function h(
  type: unknown,
  props?: Record<string, unknown> | null,
  children?: unknown[],
): VNode;

function component(
  name: string,
  factory: (props: Record<string, unknown>, ctx: Ctx) => () => VNode,
): ComponentType;

const Fragment: unique symbol;
```

`h` stores `key` from `props.key`. Components receive a stable `props` object
with a `children` array; frontmatter runs once per instance and the render
function re-runs when dirty.

## `VNode`

```ts
interface VNode {
  readonly type: unknown; // string intrinsic, ComponentType, or Fragment
  readonly props: Record<string, unknown>;
  readonly children: unknown[];
  readonly key?: unknown;
}
```

Strings/numbers become text nodes; arrays flatten; `null`/`undefined`/booleans
are skipped; function children are component slots.

## `createApp`

```ts
function createApp(
  type: ComponentType,
  props?: Record<string, unknown>,
  options?: AppOptions,
): App;

interface AppOptions {
  screen?: AppScreen; // injectable for tests
  input?: AppInput; // injectable for tests
  onKey?: (event: KeyInputEvent) => void;
  exitOnCtrlC?: boolean; // default true
}

interface App {
  readonly root: Root;
  start(): void;
  stop(): void;
}
```

`start()` enters the alternate screen, starts keyboard input and mounts the
component. `stop()` restores raw mode/cursor/alternate screen and unmounts.
Resize is polled; the terminal is cleared and repainted atomically. Fatal frame
errors call `root.onError`, which `createApp` uses to restore the terminal
before rethrowing.

`AppScreen`/`AppInput` are the minimal interfaces implemented by `Screen` and
`Keyboard`; tests can provide fakes.

## `Root`

```ts
class Root {
  readonly document: FragmentNode;
  readonly focus: FocusManager;
  mounted: ComponentNode | null;
  onError: ((error: unknown) => void) | null;

  mount(type: ComponentType, props?: Record<string, unknown>): void;
  unmount(): void;
  flush(): void;
  onCommit(listener: (document: FragmentNode) => void): () => void;
  dispatchKey(event: KeyEvent): KeyInputEvent;
  markDirty(instance: Instance): void;
  forget(instance: Instance): void;
}
```

- `mount` is synchronous; initial render and effects run before it returns.
- `flush` runs pending dirty work (normally scheduled as a microtask).
- `onCommit` fires after a frame commits; renderers consume `document`.
- `dispatchKey` routes focused → global → Tab → returns the event for the app.

## `Ctx`

| Method                     | Behavior                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `use(value)`               | If store-shaped (`get`+`subscribe`), subscribe the instance and return `get()`; otherwise return the value. Throws during frontmatter. |
| `expr(thunk)`              | Evaluate, then `use(result)` (unwraps a store-returning expression). Throws during frontmatter.                                        |
| `watch(store)`             | Subscribe explicitly; frontmatter-safe.                                                                                                |
| `effect(fn)`               | Run after mount and after every re-render; the previous cleanup runs first. Return a cleanup. Frontmatter-only.                        |
| `onCleanup(fn)`            | Run once on unmount. Frontmatter-only.                                                                                                 |
| `focus(options?)`          | Register in the focus order; returns `FocusHandle`. Frontmatter-only.                                                                  |
| `onKey(handler, options?)` | Keys while focused, or always with `{ global: true }`. Returns an unsubscribe. Frontmatter-only.                                       |

```ts
interface FocusHandle {
  isFocused(): boolean; // reactive during render
  focus(): void;
  blur(): void;
}
```

## Keys

```ts
interface KeyInputEvent {
  name: string;
  sequence: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  text: string | null;
  defaultPrevented: boolean;
  propagationStopped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}
```

`KeyEvent` (terminal) is the un-wrapped shape. Routing order: focused handlers →
global handlers → Tab/Shift-Tab (unless prevented) → app `onKey` (unless
stopped) → Ctrl-C quit (unless prevented).

## Lifecycle

1. Factory called once with stable props and `ctx` (frontmatter).
2. Render function produces a vnode subtree.
3. The subtree reconciles into persistent `component|element|text|fragment`
   nodes.
4. Effects run for the instance.
5. Dirty instances are processed parents-first; prop changes can schedule child
   renders in later passes of the same frame. Frames are capped at 100 passes.

Unmount releases subscriptions, effect cleanups and `onCleanup` handlers, and
removes focus/global key registrations.

## Reconciliation

- Components reuse instances when type and key match; props are shallow compared
  (children element-wise) and mutated in place.
- Elements reuse by tag and key; children reconcile positionally, or by key when
  any child has one.
- Unmatched old nodes unmount. Duplicate keys keep one keyed node and place the
  extra in the positional pool so it is still unmounted.
- Text nodes update in place.

## Errors

There are no error boundaries. A render/effect error propagates; `createApp`
restores the terminal through `root.onError` and rethrows. `root.onError` can be
set directly when using `Root` without `createApp`.

## Writing components by hand

```ts
import { component, h, Text } from "@denotui/deno-tui";

const Counter = component("Counter", (props, ctx) => {
  const count = Number(props.count ?? 0);
  return () => h(Text, { bold: true }, [String(count)]);
});
```

Prefer `.tui` components for authoring; the runtime API is stable for
hand-written primitives and tests.
