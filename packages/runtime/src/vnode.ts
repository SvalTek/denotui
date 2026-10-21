/**
 * VNode model shared by generated modules, built-ins and user components.
 *
 * A vnode is deliberately a plain object: no classes, no hidden fields. The
 * runtime owns all mutable state in its own node tree (see `engine.ts`), which
 * keeps freshly rendered vnodes cheap to allocate and compare.
 */

/** Template root and `<>...</>` marker. */
export const Fragment: unique symbol = Symbol.for("denotui.fragment");

export interface VNode {
  readonly type: unknown;
  readonly props: Record<string, unknown>;
  readonly children: unknown[];
  readonly key?: unknown;
}

/** Create a virtual node. Used by generated `.tui.ts` modules and built-ins. */
export function h(
  type: unknown,
  props: Record<string, unknown> | null = null,
  children: unknown[] = [],
): VNode {
  const resolved = props ?? {};
  return { type, props: resolved, children, key: resolved.key };
}

export function isVNode(value: unknown): value is VNode {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as {
    type?: unknown;
    props?: unknown;
    children?: unknown;
  };
  return "type" in candidate && typeof candidate.props === "object" &&
    candidate.props !== null && Array.isArray(candidate.children);
}
