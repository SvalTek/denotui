# Rendering Pipeline

This document describes how a committed component tree reaches the terminal. It
is the implementation contract for `@denotui/layout`, `@denotui/terminal` and
the runtime's `createApp` loop.

## Stack

| Concern          | Choice                                                    | Why                                                                                                                                                     |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flexbox          | `yoga-layout` (WASM)                                      | Cross-platform, battle-tested, already validated in exp3. We only bind props to it.                                                                     |
| Text metrics     | `string-width`, `wrap-ansi`                               | Visual cell width and wrapping shared by measurement and paint.                                                                                         |
| Key decoding     | Node `readline.emitKeypressEvents` via Deno's Node compat | Handles UTF-8 and CSI/SS3 sequences; verified under Deno on a real PTY. Behind our `KeyEvent` seam.                                                     |
| Terminal I/O     | own `ansi.ts` + `CellBuffer` + `diffBuffers`              | The hard part is cell diffing and SGR state, which no maintained library provides in a form that fits this model. Sequences are stable and unit-tested. |
| Screen lifecycle | own `Screen`                                              | Alternate screen, cursor visibility, resize polling, restore.                                                                                           |

Rejected: **Ink** and anything built on it (its layout/paint/reconciler issues
are why this project exists), `terminal-kit`/`blessed` (own widget and layout
models would fight the vnode→Yoga pipeline), `ansi-diff` (line-based, not
full-screen cell diff).

## Pipeline

```
runtime commit (persistent node tree)
   │  layoutTree(tree, {width, height})
   ▼
positioned tree: boxes + text runs (lines already wrapped, clipped/scrolled)
   │  paintLayout(buffer, tree)
   ▼
back CellBuffer
   │  diffBuffers(front, back)
   ▼
minimal ANSI string → Screen.write → stdout
```

`createApp()` wires this to `root.onCommit`. Store updates are already coalesced
by the runtime, so each commit paints at most once. Resize resets both buffers
and repaints from scratch.

Keyboard input follows a separate path: terminal bytes → Node `readline` →
`KeyEvent` → `root.dispatchKey` (focused handlers, global handlers, Tab
traversal) → `createApp({ onKey })` for keys nobody consumed.

## Layout

- Component and fragment nodes are transparent; their children participate in
  the parent's flex layout.
- `Box` props map to Yoga: `direction`, `padding`/`margin` (number, `[v, h]`,
  `[t, r, b, l]` or per-edge object), `gap`, `width`/`height`/min/max (number,
  percent string, `auto`), `flexGrow`/`flexShrink`/`flexBasis`,
  `justifyContent`, `alignItems`, `alignSelf`, `alignContent`, `wrap`,
  `overflow`, `display`.
- **Box defaults to `direction: "column"`.** Raw Yoga defaults to row; terminal
  content stacks, so the framework default is column. Set `direction="row"`
  explicitly for horizontal rows.
- A `Box`'s height is content-sized unless it has `height` or `flexGrow`. The
  terminal root is a column container of the terminal size; a top-level box
  stretches horizontally but not vertically.
- `Text` is a leaf. Its children are concatenated; a host element inside `Text`
  is an error. Bare text directly under a `Box` becomes an implicit unstyled
  text run.
- Text style: `fg`, `bg` (named ANSI, 0-255 palette, `#rgb`/`#rrggbb`), `bold`,
  `dim`, `italic`, `underline`, `inverse`, `wrap` (default true). Styles do not
  inherit through boxes in v1.
- Yoga measure modes are respected: `Exactly` fixes the size, `AtMost` clamps
  content, `Undefined` uses content size.

### Measurement invariant

`wrapText` (shared by the measure callback and the painter) normalizes newlines
and expands tabs once. A text node measured at width W returns exactly the line
count that `accumulate`/paint produces at that width. This is the invariant that
failed in Deno-Ink; do not duplicate width logic in either side.

## Cells and painting

- `Cell = { char, width: 1|2, style, continuation }`. A wide glyph occupies a
  lead cell plus a continuation cell; overwriting either half clears the pair.
- Graphemes are segmented with `Intl.Segmenter`; width comes from
  `string-width`. Combining marks attach to the previous base cell. Wide glyphs
  are never split at a clip edge.
- `paintLayout` fills box backgrounds, then paints text lines clipped to the
  text box and buffer. Sibling overflow clipping is not implemented in v1.
- Styles are per cell, so resets inside text cannot leak a background (the
  problem string-painting TUIs work around by re-applying backgrounds).

## Diff and output

`diffBuffers(front, back)` walks rows and emits:

- a cursor move per changed run (absolute `\x1b[row;colH`),
- an SGR sequence when the style changes (attributes + fg/bg),
- only changed characters; unchanged runs are skipped,
- `RESET` at the end if a non-default style was active.

An idle frame emits `""`. The first frame of a session is a full paint because
the front buffer starts blank. `Screen.write` loops on `Deno.stdout.writeSync`
until all bytes are written; frames are built as one string before writing.

## Screen lifecycle

- `Screen.start()` enters the alternate screen, clears it, hides the cursor.
- `Screen.stop()` resets attributes, shows the cursor and leaves the alternate
  screen. Call it in `finally`/on quit; `createApp.stop()` does this.
- Size comes from `Deno.consoleSize()`, polled every 200 ms (SIGWINCH is not
  available on Windows). Listeners fire only when the size changes. A missing
  TTY falls back to 80×24.
- Colors assume a modern VT terminal. Legacy Windows conhost is out of scope;
  Windows Terminal is the target.

## Input

`Keyboard` puts the Node-compatible stdin into raw mode and attaches
`readline.emitKeypressEvents`. Events are normalized to:

```ts
interface KeyEvent {
  name: string; // "a", "up", "return", "escape", "backspace"…
  sequence: string; // raw sequence
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  text: string | null; // printable text only
}
```

`createApp` sends them to `onKey` and quits on Ctrl-C by default. Application
code stops the app explicitly (e.g. `q`). `attachKeypress` accepts any Node
`Readable`, which is how the parser is unit-tested without a TTY.

## Testing

- Layout: geometry assertions and a measure/paint line-count agreement test.
- Terminal: buffer writes (wide glyphs, combining marks, clipping), exact diff
  strings, SGR serialization, screen lifecycle with a fake writer, key
  normalization with a synthetic Node stream.
- App: fake screen/input drive mount, store update, resize and quit headlessly.
- Live: a PTY script (`local/experiments/exp6_app.ts`) exercises alt-screen,
  styled output, an update frame and restore.

## Interaction

`ctx.focus()` registers a component in mount order; the first focusable gets
focus, Tab/Shift-Tab cycles, and unmounting the focused component hands focus to
the next. Focus changes dirty the instance, so `handle.isFocused()` is reactive.

`ctx.onKey(handler)` runs only while focused; `{ global: true }` always runs.
Events expose `preventDefault()` (Tab stays in the component) and
`stopPropagation()` (the app does not see the key). `createApp({ onKey })`
receives the remainder and quits on Ctrl-C unless prevented.

Bundled controls (`TextInput`, `Select`, `Checkbox`, `Toggle`, `Button`) own
their key handling and support controlled props plus callbacks. `ScrollView`
handles arrows/page keys when `focusable`.

## Known limits (v1)

- Text is plain; ANSI in user text is not parsed. OSC-8 hyperlinks are not
  represented in the cell model.
- No mouse or bracketed paste.
- Style inheritance through boxes is deferred.
- Layout has no cache: the Yoga tree is rebuilt per commit.
