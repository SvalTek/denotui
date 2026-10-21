# Terminal Reference

Package: `@denotui/terminal`. Most apps consume this through `createApp`; the
primitives are exposed for custom render loops and tests.

## Screen

```ts
new Screen(options?: ScreenOptions);

interface ScreenOptions {
  writer?: { writeSync(data: Uint8Array): number };
  size?: () => { columns: number; rows: number };
  altScreen?: boolean;     // default true
  resizePollMs?: number;   // default 50
}

class Screen {
  readonly size: TerminalSize;
  readonly started: boolean;
  start(): void;
  stop(): void;
  write(frame: string): void;
  onResize(listener: (size: TerminalSize) => void): () => void;
  checkResize(): void;
}
```

- `start()` resets SGR state, enters the alternate screen, clears it, hides the
  cursor and disables autowrap (`DECAWM`), so writing the bottom-right cell
  cannot scroll.
- `stop()` resets, re-enables autowrap, shows the cursor and exits the alternate
  screen. Call it in a `finally` or on quit.
- `write` loops on partial `writeSync` results.
- Size defaults to `Deno.consoleSize()` and falls back to 80×24 without a TTY.
  Polling fires listeners only on change.
- The writer and size source are injectable for headless tests.

## Cells and buffers

```ts
interface Cell {
  char: string;
  width: 1 | 2;
  style: Style | null;
  continuation: boolean;
}

class CellBuffer {
  readonly width: number;
  readonly height: number;
  readonly cells: Cell[];
  constructor(width: number, height: number);
  cellAt(column: number, row: number): Cell;
  clear(): void;
  fill(
    x: number,
    y: number,
    width: number,
    height: number,
    style: Style | null,
  ): void;
  putText(
    x: number,
    y: number,
    text: string,
    style: Style | null,
    maxWidth?: number,
  ): number;
}
```

- Cells are row-major and reused between frames.
- `putText` segments graphemes (`Intl.Segmenter`), uses `string-width`, attaches
  combining marks, never splits a wide glyph at the clip edge, and clears both
  halves when overwriting a wide glyph.
- A wide glyph uses a lead cell plus a continuation cell.

## Styles and colors

```ts
type Color = string | number; // named, 0-255, #rgb, #rrggbb
interface Style {
  fg: Color | null;
  bg: Color | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
}

function sgr(style: Style | null): string;
```

`sgr` emits `RESET` before the style codes. SGR attributes are cumulative;
without the reset, inverse/background/bold leak into later cells.

## Diffing

```ts
function diffBuffers(
  front: CellBuffer,
  back: CellBuffer,
  force = false,
): string;
```

- Emits a cursor move per changed run, SGR changes when the style changes, and
  only changed characters.
- `force` writes every cell (including blanks) for a full repaint.
- Ends with `RESET` when needed and parks the hidden cursor at home (`\x1b[H`),
  so a resize cannot scroll to the cursor.
- An unchanged frame returns `""`.

## Keyboard

```ts
interface KeyEvent {
  name: string; // "a", "up", "return", "escape", "backspace", …
  sequence: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  text: string | null;
}

class Keyboard {
  constructor(options?: { stream?: KeypressStream });
  start(onKey: (key: KeyEvent) => void): void;
  stop(): void;
}

function attachKeypress(
  stream: KeypressStream,
  onKey: (key: KeyEvent) => void,
): () => void;
function normalizeKeypress(
  text: string | undefined,
  key: RawKeypress,
): KeyEvent;
```

`Keyboard` puts the Node-compatible stdin into raw mode and uses
`readline.emitKeypressEvents`. `attachKeypress` accepts any Node readable, which
is how key decoding is tested without a TTY. `stop()` restores raw mode and
detaches the parser.

## ANSI helpers

`CLEAR_SCREEN`, `ENTER_ALT_SCREEN`, `EXIT_ALT_SCREEN`, `HIDE_CURSOR`,
`SHOW_CURSOR`, `DISABLE_WRAP`, `ENABLE_WRAP`, `RESET`, `CURSOR_HOME`,
`cursorTo(row, column)`, `sgr(style)`.

## Lifecycle expectations

- Restore raw mode, cursor and alternate screen on every exit path. `createApp`
  does this in `stop()` and on fatal frame errors via `root.onError`.
- Do not write to stdout while the screen is active; compose one frame string
  and call `write`.
- Target modern VT terminals. Legacy Windows conhost is unsupported.
