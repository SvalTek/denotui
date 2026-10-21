/**
 * @denotui/layout — Yoga-backed flexbox layout and terminal-aware text
 * measurement.
 *
 * The input is the runtime's committed node tree (structurally: component and
 * fragment containers plus `box`/`text` hosts). The output is a positioned tree
 * of boxes and text runs that `paintLayout` writes into a cell buffer.
 */
export { layoutTree } from "./src/engine.ts";
export { paintLayout } from "./src/paint.ts";
export {
  normalizeText,
  splitLines,
  textWidth,
  wrapText,
} from "./src/measure.ts";
export type {
  LayoutBox,
  LayoutInput,
  LayoutInputContainer,
  LayoutInputHost,
  LayoutInputText,
  LayoutNode,
  LayoutOptions,
  LayoutText,
} from "./src/types.ts";
