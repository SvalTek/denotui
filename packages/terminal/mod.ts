/**
 * @denotui/terminal — cell buffers, frame-diff painting, screen management and
 * raw-mode keyboard input.
 *
 * Rendering is intentionally split from layout: this package knows how to turn
 * positioned text/boxes into cells and how to emit minimal ANSI updates, but
 * nothing about components or flexbox. `@denotui/runtime`'s app helper wires the
 * two together.
 */
export {
  CLEAR_SCREEN,
  CURSOR_HOME,
  cursorTo,
  DISABLE_WRAP,
  ENABLE_WRAP,
  ENTER_ALT_SCREEN,
  EXIT_ALT_SCREEN,
  HIDE_CURSOR,
  RESET,
  sgr,
  SHOW_CURSOR,
} from "./src/ansi.ts";
export { type Cell, CellBuffer } from "./src/buffer.ts";
export { diffBuffers } from "./src/diff.ts";
export {
  attachKeypress,
  Keyboard,
  type KeyboardOptions,
  type KeyEvent,
  type KeypressStream,
  normalizeKeypress,
} from "./src/input.ts";
export {
  type FrameWriter,
  Screen,
  type ScreenOptions,
  type TerminalSize,
} from "./src/screen.ts";
export {
  type Color,
  DEFAULT_STYLE,
  type Style,
  stylesEqual,
} from "./src/style.ts";
