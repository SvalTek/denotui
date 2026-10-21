/**
 * @denotui/runtime — component instances, vnode model, reactivity and
 * reconciliation. UI components live in `@denotui/components`.
 *
 * Pipeline: `component()` factories run their frontmatter once per instance and
 * return a render function. Rendering produces vnodes (`h`), which the engine
 * reconciles into a persistent node tree. Store reads in templates are compiled
 * to `ctx.use($store)`, which subscribes the owning instance; notifications are
 * coalesced into one microtask frame.
 *
 * `createRoot()` owns the document tree; renderers register `root.onCommit`
 * (the layout/paint packages in M4 consume the committed tree).
 */
export { component, type ComponentType } from "./src/component.ts";
export type { Ctx, EffectFn } from "./src/ctx.ts";
export { isStore, type StoreLike } from "./src/store.ts";
export { Fragment, h, isVNode, type VNode } from "./src/vnode.ts";
export {
  type ComponentNode,
  type ContainerNode,
  createRoot,
  type ElementNode,
  type FragmentNode,
  Instance,
  type Node,
  type NodeBase,
  Root,
  type TextNode,
} from "./src/engine.ts";
export {
  type FocusHandle,
  type FocusManager,
  type FocusOptions,
  type KeyHandler,
  type KeyHandlerOptions,
  type KeyInputEvent,
} from "./src/focus.ts";
export {
  type App,
  type AppInput,
  type AppOptions,
  type AppScreen,
  createApp,
} from "./src/app.ts";
