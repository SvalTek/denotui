# Input and Focus

Components own focus and key handling. Application code does not reimplement
typing or arrow navigation for built-in controls.

## Focus order

- A component registers with `ctx.focus()` in frontmatter.
- The first focusable component mounts focused; `autoFocus` requests focus
  explicitly.
- `Tab` / `Shift-Tab` cycle in mount order, wrapping.
- Unmounting the focused component moves focus to the next one.
- Focus changes dirty the instances involved, so `handle.isFocused()` is
  reactive during render.

Built-in controls that register focus: `Button`, `TextInput`, `Select`,
`Checkbox`, `Toggle`, and `ScrollView` when `focusable`.

## Custom components

```ts
import { component, h } from "@denotui/deno-tui";
import { Text } from "@denotui/deno-tui";

export const Field = component("Field", (props, ctx) => {
  const focus = ctx.focus({ autoFocus: props.autoFocus === true });

  ctx.onKey((event) => {
    if (event.name === "return") {
      const onSubmit = props.onSubmit;
      if (typeof onSubmit === "function") (onSubmit as () => void)();
      event.preventDefault();
    }
  });

  return () =>
    h(Text, { inverse: focus.isFocused() }, [String(props.label ?? "")]);
});
```

`ctx.focus()` returns `{ isFocused(), focus(), blur() }`. `ctx.onKey()` runs
only while focused; `{ global: true }` handlers always run. Both must be
registered in frontmatter.

## Key events

`ctx.onKey` receives a `KeyInputEvent`:

```ts
interface KeyInputEvent {
  name: string; // "a", "up", "return", "escape", "backspace", ...
  sequence: string; // raw sequence
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  text: string | null; // printable text only
  defaultPrevented: boolean;
  propagationStopped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}
```

- `preventDefault()` suppresses the default Tab traversal and tells the app the
  key was handled.
- `stopPropagation()` keeps later focused/global handlers and the app handler
  from seeing the key.

Routing order in `createApp`:

1. focused handlers,
2. global handlers,
3. Tab/Shift-Tab traversal unless prevented,
4. application `onKey`, unless propagation stopped,
5. Ctrl-C quit unless prevented.

```ts
const app = createApp(App, {}, {
  onKey(event) {
    if (!event.defaultPrevented && event.name === "down") {
      moveSelection(1);
      event.preventDefault();
    }
    if (event.name === "escape") app.stop();
  },
});
```

## Built-in key maps

| Component    | Keys                                                                        |
| ------------ | --------------------------------------------------------------------------- |
| `TextInput`  | printable text, Backspace, Delete, Left/Right, Home/End, Enter (`onSubmit`) |
| `Select`     | Up/Down or k/j, Home/End, Enter (`onSelect`)                                |
| `Checkbox`   | Space/Enter toggles                                                         |
| `Toggle`     | Space/Enter toggles                                                         |
| `Button`     | Enter/Space activates                                                       |
| `ScrollView` | Up/Down, PageUp/PageDown, Home/End when `focusable`                         |

`TextInput` is controlled: it emits `onChange(nextValue)` and keeps its own
cursor. It ignores Ctrl/Meta-modified keys so application shortcuts still work.

## Focus in layouts

A common pattern is a filter input plus a list. Arrow keys can drive the list
while the input keeps focus:

```tui
<TextInput value={$filter} autoFocus onChange={setFilter} />
<Select items={filtered($agents, $filter)} selected={$selected} onChange={select} />
```

When `Select` is focused it consumes arrows; when `TextInput` is focused it does
not, so the app-level handler can move the selection. Check
`event.defaultPrevented` in the app handler to avoid double movement.

## Status

Mouse and bracketed paste are not implemented. The key decoder is Node's
`readline` parser behind the terminal `KeyEvent` seam.
