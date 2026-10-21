/**
 * The component-facing context.
 *
 * Frontmatter runs exactly once per instance, so reactivity lives in the
 * template layer: every template expression is compiled to
 *
 *   ctx.expr(() => ( ... ))
 *
 * and every `$store` read inside it is compiled to
 *
 *   ctx.use($store)
 *
 * `ctx.use` is what makes `{$agents.length}` work: it subscribes the owning
 * component and returns the store's current value, so the `.length` applies to
 * the value rather than to the store object.
 */
import type { StoreLike } from "./store.ts";
import type {
  FocusHandle,
  FocusOptions,
  KeyHandler,
  KeyHandlerOptions,
} from "./focus.ts";

export type EffectFn = () => void | (() => void);

export interface Ctx {
  /**
   * Read a value, subscribing the owning component when it is a store.
   *
   * Emitted by the compiler for `$store` identifiers in template expressions
   * (and available directly as the escape hatch for stores whose names do not
   * follow the `$` convention). Calling it while frontmatter is running throws:
   * frontmatter is not re-evaluated, so the snapshot would go stale. Use
   * {@link Ctx.watch} there instead.
   */
  use<T>(value: StoreLike<T>): T;
  use<T>(value: T): T;

  /**
   * Evaluate a template expression, unwrapping a store returned by it.
   *
   * This stays necessary for expressions that *produce* a store, e.g.
   * `<Map for={computed(...)}>` or `{$title}` (rewritten to `ctx.use($title)`).
   */
  expr<T>(evaluate: () => StoreLike<T>): T;
  expr<T>(evaluate: () => T): T;

  /** Subscribe the instance to a store explicitly (frontmatter-safe). */
  watch(store: StoreLike<unknown>): void;

  /** Run after every commit of this instance; return a cleanup for the next run. */
  effect(fn: EffectFn): void;

  /** Run once when this instance unmounts. */
  onCleanup(fn: () => void): void;

  /**
   * Register this component in the focus order. Focus changes dirty the
   * instance, so render functions can draw a focus ring. Call in frontmatter.
   */
  focus(options?: FocusOptions): FocusHandle;

  /**
   * Receive keys while focused (or always with `{ global: true }`). Returned
   * function unsubscribes. Call in frontmatter.
   */
  onKey(handler: KeyHandler, options?: KeyHandlerOptions): () => void;
}
