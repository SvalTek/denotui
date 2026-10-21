/**
 * Component declaration.
 *
 * Generated modules call `component(name, factory)`; the factory receives props
 * plus the instance `ctx` and returns the render function. The factory body is
 * the authored frontmatter and runs once per instance; the returned function
 * re-runs whenever the instance is dirty.
 */
import type { Ctx } from "./ctx.ts";
import type { VNode } from "./vnode.ts";

export type ComponentFactory = (
  props: Record<string, unknown>,
  ctx: Ctx,
) => () => VNode;

export interface ComponentType {
  readonly name: string;
  readonly factory: ComponentFactory;
}

export function component(
  name: string,
  factory: ComponentFactory,
): ComponentType {
  return { name, factory };
}

export function isComponentType(value: unknown): value is ComponentType {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { name?: unknown; factory?: unknown };
  return typeof candidate.name === "string" &&
    typeof candidate.factory === "function";
}
