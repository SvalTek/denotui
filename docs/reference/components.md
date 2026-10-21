# Component Reference

All components are ordinary values exported by the app barrel. The compiler
auto-imports the core vocabulary; `Separator` and application components are
imported in frontmatter. Unknown props are ignored unless noted.

## Base

### `Box`

Flex container; maps props to Yoga.

| Prop                                                                | Type                                                            | Default        | Notes                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------------- | -------------- | ---------------------------------------------------- |
| `direction`                                                         | `"row"`, `"column"`, `"row-reverse"`, `"column-reverse"`        | `"column"`     | TUI default differs from Yoga                        |
| `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight` | number, percent string, `"auto"`                                | auto/content   | Percent against parent content box                   |
| `flexGrow`, `flexShrink`                                            | number                                                          | Yoga defaults  |                                                      |
| `flexBasis`                                                         | number, percent, `"auto"`                                       | auto           |                                                      |
| `padding`, `margin`                                                 | number, `[v,h]`, `[t,r,b,l]`, object                            | 0              | Edges: top/right/bottom/left/horizontal/vertical/all |
| `gap`                                                               | number, `[row,column]`, `{row,column}`                          | 0              |                                                      |
| `justifyContent`                                                    | start/center/end/space-between/space-around/space-evenly        | flex-start     |                                                      |
| `alignItems`, `alignSelf`, `alignContent`                           | auto/start/center/end/stretch/baseline/space-*                  | stretch (Yoga) |                                                      |
| `wrap`                                                              | nowrap/wrap/wrap-reverse                                        | nowrap         |                                                      |
| `overflow`                                                          | visible/hidden/scroll                                           | visible        | `hidden` clips children to the content box           |
| `display`                                                           | flex/none                                                       | flex           |                                                      |
| `border`                                                            | `true`, `"single"`, `"round"`, `"double"`, `"heavy"`, `"ascii"` | none           | Sets border widths                                   |
| `borderEdges`                                                       | string array or edge booleans                                   | all            | e.g. `["top"]`                                       |
| `borderColor`                                                       | color                                                           | null           |                                                      |
| `bg`                                                                | color                                                           | null           | Fills the box; inherited by text/border cells        |
| `scrollX`, `scrollY`                                                | number                                                          | 0              | Shifts children; use with `overflow="hidden"`        |

### `Text`

| Prop                                            | Type    | Default | Notes                                  |
| ----------------------------------------------- | ------- | ------- | -------------------------------------- |
| `fg`, `bg`                                      | color   | null    | Named, palette 0-255, `#rgb`/`#rrggbb` |
| `bold`, `dim`, `italic`, `underline`, `inverse` | boolean | false   |                                        |
| `wrap`                                          | boolean | true    | Shared measure/paint wrapping          |

Text children concatenate; a host element child throws.

### `Map`

| Prop  | Type                     | Default                          | Notes                |
| ----- | ------------------------ | -------------------------------- | -------------------- |
| `for` | array                    | required                         | Items                |
| child | `(item, index) => vnode` | required                         | Called once per item |
| keys  | —                        | `item.id`/`item.key`, else index | Keys the rows        |

Renders a fragment of rows; no extra host element.

## Layout

### `Row`, `Column`

`Box` presets for `direction="row"` / `"column"`; all Box props pass through.

### `Center`

`Box` with `justifyContent="center"`, `alignItems="center"`, `flexGrow={1}`
(overridable).

### `Spacer`

`Box` with `flexGrow={1}` and no children.

### `Divider`

| Prop          | Type                         | Default    |
| ------------- | ---------------------------- | ---------- |
| `style`       | border style                 | `"single"` |
| `color`       | color                        | `"gray"`   |
| `orientation` | `"horizontal"`, `"vertical"` | horizontal |
| `vertical`    | boolean                      | false      |
| `margin`      | spacing                      | none       |

Horizontal is a 1-row top border; vertical is a 1-column left border.

### `Panel`

| Prop          | Type          | Default    |
| ------------- | ------------- | ---------- |
| `border`      | boolean/style | `true`     |
| `borderColor` | color         | `"gray"`   |
| `padding`     | spacing       | 1          |
| `direction`   | direction     | `"column"` |

All remaining Box props pass through.

## Text

### `Badge`

| Prop                    | Type    | Default   |
| ----------------------- | ------- | --------- |
| `label` / text children | string  | `""`      |
| `bg`                    | color   | `"blue"`  |
| `fg`                    | color   | `"white"` |
| `bold`                  | boolean | true      |
| `dim`                   | boolean | false     |
| `padding`               | spacing | `[0,1]`   |
| `margin`                | spacing | none      |

### `Alert`

| Prop           | Type                                  | Default      |
| -------------- | ------------------------------------- | ------------ |
| `variant`      | `info`, `success`, `warning`, `error` | `info`       |
| `title`        | string                                | variant name |
| `border`       | boolean/style                         | `"round"`    |
| `padding`      | spacing                               | 1            |
| `gap`          | number                                | 1            |
| `bg`, `margin` | color/spacing                         | none         |

Icons are text/ASCII (`i`, `+`, `!`, `x`) to avoid color-emoji width issues.

## Feedback

### `Spinner`

| Prop     | Type     | Default     |
| -------- | -------- | ----------- |
| `label`  | string   | none        |
| `fps`    | number   | 10          |
| `active` | boolean  | true        |
| `color`  | color    | `"cyan"`    |
| `frames` | string[] | Braille set |

Owns a frontmatter timer; cleaned up on unmount. Re-render does not restart the
timer.

### `ProgressBar`

| Prop          | Type    | Default   |
| ------------- | ------- | --------- |
| `value`       | number  | 0         |
| `max`         | number  | 100       |
| `width`       | number  | 20        |
| `label`       | string  | none      |
| `labelDim`    | boolean | true      |
| `filledColor` | color   | `"green"` |
| `emptyColor`  | color   | `"gray"`  |
| `showPercent` | boolean | true      |

## Data

### `List`

| Prop          | Type                               | Default                     |
| ------------- | ---------------------------------- | --------------------------- |
| `items`       | array                              | required                    |
| `selected`    | number                             | -1                          |
| `marker`      | string                             | `">"`                       |
| `markerColor` | color                              | focused ? brightCyan : gray |
| `focused`     | boolean                            | false                       |
| `gap`         | number                             | 0                           |
| child         | `(item, index, selected) => vnode` | none (uses label)           |

Presentational; does not handle keys.

### `Select`

| Prop                           | Type            | Default                  |
| ------------------------------ | --------------- | ------------------------ |
| `items`                        | array           | `[]`                     |
| `selected`                     | number          | controlled when provided |
| `onChange(item, index)`        | function        | none                     |
| `onSelect(item, index)`        | function        | none (Enter)             |
| `autoFocus`                    | boolean         | false                    |
| `marker`, `markerColor`, `gap` | as List         |                          |
| child                          | render function | required for custom rows |

Arrows/j/k, Home/End, Enter. Controlled or internal selection.

### `Table`

| Prop                       | Type                              | Default  |
| -------------------------- | --------------------------------- | -------- |
| `columns`                  | `{key, title?, width?, align?}[]` | required |
| `rows`                     | object[]                          | `[]`     |
| `gap`                      | number                            | 1        |
| `header`                   | boolean                           | true     |
| `headerBold`               | boolean                           | true     |
| `headerColor`, `cellColor` | color                             | none     |
| `rowGap`                   | number                            | 0        |

Widths default to the maximum display width of title/cells. Alignment is
`left`/`right`.

### `KeyValue`

| Prop                       | Type                        | Default |
| -------------------------- | --------------------------- | ------- |
| `items`                    | `{label,value}[]` or object | `{}`    |
| `gap`                      | number                      | 0       |
| `separatorGap`             | number                      | 1       |
| `labelColor`, `valueColor` | color                       | none    |

Labels pad to the widest label in display cells.

## Controls

### `Button`

| Prop                      | Type     | Default   |
| ------------------------- | -------- | --------- |
| `label` / text children   | string   | `""`      |
| `onPress`                 | function | none      |
| `autoFocus`               | boolean  | false     |
| `focusBg`                 | color    | `"blue"`  |
| `focusFg`                 | color    | `"white"` |
| `padding`                 | spacing  | `[0,1]`   |
| `bg`, `fg`, `bold`, `dim` |          |           |

Enter/Space activates; registers focus.

### `TextInput`

| Prop                                                | Type     | Default      |
| --------------------------------------------------- | -------- | ------------ |
| `value`                                             | string   | `""`         |
| `placeholder`                                       | string   | `""`         |
| `onChange(value)`                                   | function | none         |
| `onSubmit(value)`                                   | function | none (Enter) |
| `autoFocus`                                         | boolean  | false        |
| `mask`                                              | string   | none         |
| `fg`, `cursorColor`, `cursorBg`, `placeholderColor` | color    | none         |

Controlled value plus internal cursor. Printable text, Backspace, Delete,
Left/Right, Home/End, Enter. Ctrl/Meta keys are left to the app.

### `Checkbox`

| Prop                    | Type     | Default |
| ----------------------- | -------- | ------- |
| `checked`               | boolean  | false   |
| `label` / text children | string   | `""`    |
| `onChange(checked)`     | function | none    |
| `autoFocus`             | boolean  | false   |
| `color`, `labelColor`   | color    |         |

Space/Enter toggles.

### `Toggle`

| Prop                                | Type     | Default    |
| ----------------------------------- | -------- | ---------- |
| `on` / `checked`                    | boolean  | false      |
| `label` / text children             | string   | `""`       |
| `onChange(on)`                      | function | none       |
| `autoFocus`                         | boolean  | false      |
| `onColor`, `offColor`, `labelColor` | color    | green/gray |

Space/Enter toggles.

### `Tabs`

| Prop                   | Type     | Default    |
| ---------------------- | -------- | ---------- |
| `tabs`                 | string[] | `[]`       |
| `active`               | number   | 0          |
| `activeBg`, `activeFg` | color    | blue/white |
| `bg`, `fg`             | color    | none       |
| `gap`                  | number   | 0          |

Presentational; no key handling.

## Chrome

### `StatusBar`

| Prop            | Type    | Default    |
| --------------- | ------- | ---------- |
| `left`, `right` | string  | `""`       |
| `bg`, `fg`      | color   | blue/white |
| `bold`          | boolean | false      |
| `padding`       | spacing | `[0,1]`    |
| `width`         | size    | `"100%"`   |

### `HelpBar`

| Prop                     | Type                      | Default   |
| ------------------------ | ------------------------- | --------- |
| `items`                  | `{key,label}[]` or object | `[]`      |
| `keyColor`, `labelColor` | color                     | cyan/none |
| `bg`                     | color                     | none      |
| `padding`                | spacing                   | `[0,1]`   |
| `width`                  | size                      | `"100%"`  |

### `Separator`

| Prop   | Type   | Default |
| ------ | ------ | ------- |
| `char` | string | `" · "` |

Not part of the auto-import core vocabulary.

## Scrolling

### `ScrollView`

| Prop              | Type      | Default                  |
| ----------------- | --------- | ------------------------ |
| `height`          | size      | content                  |
| `contentHeight`   | number    | unknown                  |
| `scroll`          | number    | controlled when provided |
| `onScroll(value)` | function  | none                     |
| `focusable`       | boolean   | false                    |
| `autoFocus`       | boolean   | false                    |
| `width`           | size      | `"100%"`                 |
| `direction`       | direction | `"column"`               |

Box props (`border`, `padding`, `bg`, …) pass through. With `focusable` and a
known `contentHeight`, arrows/Page/Home/End scroll and clamp. Without
`contentHeight`, key scrolling is disabled; a controlled `scroll` still applies.

## Control flow

### `Show`

| Prop     | Type            | Default |
| -------- | --------------- | ------- |
| `when`   | any (truthy)    | false   |
| children | nodes/functions | —       |

Function children are invoked only when the branch renders.
