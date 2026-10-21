# @denotui/terminal

Cell buffers, glyph-aware text writes, frame diffing with SGR state, screen
lifecycle and keyboard input for **denotui**.

- `CellBuffer` handles wide glyphs, combining marks and clipping.
- `diffBuffers` emits cursor moves and only changed cells; styles reset before
  applying, so SGR state cannot leak.
- `Screen` manages the alternate screen, autowrap, cursor, resize polling and
  partial writes.
- `Keyboard` uses Node's `readline` keypress parser behind a normalized
  `KeyEvent`.

Targets modern VT terminals; legacy Windows conhost is unsupported.

Docs: [`docs/reference/terminal.md`](../../docs/reference/terminal.md).
