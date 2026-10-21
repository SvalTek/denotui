# Layout and Styling

Layout is flexbox via Yoga. Painting uses cell styles, borders and background
inheritance.

## Box defaults

`Box` is a column flex container by default (raw Yoga defaults to row). The
terminal root is a column container of the terminal size; a top-level box
stretches horizontally but is content-sized vertically unless it grows.

```tui
<Box direction="row" gap={2} padding={1} width="100%" height="100%">
  <Box flexGrow={1}>left</Box>
  <Box width={30}>fixed</Box>
</Box>
```

## Layout props

| Prop                                                                | Values                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `direction`                                                         | `row`, `column` (default), `row-reverse`, `column-reverse`                |
| `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight` | number, percent string (`"50%"`), `auto`                                  |
| `flexGrow`, `flexShrink`                                            | number                                                                    |
| `flexBasis`                                                         | number, percent, `auto`                                                   |
| `padding`, `margin`                                                 | number, `[v, h]`, `[t, r, b, l]`, or per-edge object                      |
| `gap`                                                               | number, `[row, column]`, or `{ row, column }`                             |
| `justifyContent`                                                    | `start`, `center`, `end`, `space-between`, `space-around`, `space-evenly` |
| `alignItems`, `alignSelf`, `alignContent`                           | `auto`, `start`, `center`, `end`, `stretch`, `baseline`, space variants   |
| `wrap`                                                              | `nowrap`, `wrap`, `wrap-reverse`                                          |
| `overflow`                                                          | `visible`, `hidden`, `scroll`                                             |
| `display`                                                           | `flex`, `none`                                                            |
| `scrollX`, `scrollY`                                                | number of cells to shift children (with clipping)                         |

Unknown props are ignored for layout.

## Padding, gap, sizing

```tui
<Box padding={{ top: 1, left: 2 }} gap={1} width="50%" height={10}>
  <Text>padded</Text>
</Box>
```

Percent sizes resolve against the parent's content box. Yoga may produce
fractional sizes; the layout rounds to whole terminal cells.

## Borders

```tui
<Box border="round" borderColor="cyan" padding={1} flexGrow={1}>
  <Text>inside</Text>
</Box>
```

- `border`: `true` (single) or `single`, `round`, `double`, `heavy`, `ascii`.
- `borderEdges`: array (`["top"]`) or object of edge booleans. `Divider` uses a
  top-only border; `Panel`/`Alert` use full borders.
- `borderColor`: named, palette index or hex.
- Borders inset content by one cell per enabled edge.

## Text

`Text` is a leaf; its children concatenate. A host element inside `Text` is an
error. Bare text under a `Box` becomes an implicit unstyled text run.

| Prop                                            | Values                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `fg`, `bg`                                      | named ANSI (`"red"`, `"brightBlue"`), palette `0-255`, or `#rgb`/`#rrggbb` |
| `bold`, `dim`, `italic`, `underline`, `inverse` | boolean                                                                    |
| `wrap`                                          | boolean (default `true`)                                                   |

Text wraps to the available width; `wrap={false}` keeps explicit newlines and
clips at the box. Measurement and painting share the same wrap/width code.

`Badge` is a background + padded text; `Alert` is a bordered, variant-colored
panel. See [Components](./components.md).

## Background inheritance

Text and border cells with no `bg` take the nearest ancestor box background.
This keeps surfaces contiguous; text cells do not punch terminal-default holes.

```tui
<Box bg={234}>
  <Text>inherits 234</Text>
  <Text bg="blue">explicit</Text>
</Box>
```

Foreground and attributes do not inherit.

## Colors

- Named: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`,
  `brightBlack`/`gray`, `brightRed` … `brightWhite`.
- Palette: integers `0-255` (`38;5;n`/`48;5;n`).
- Hex: `#rgb`, `#rrggbb` (truecolor).

Avoid color-emoji-presentation glyphs in content; Windows Terminal renders them
with a different width and color. The catalog uses text-presentation/ASCII
symbols.

## Clipping and scrolling

`overflow="hidden"` clips children to the content box (inside border/padding).
`scrollX`/`scrollY` shift children within that clip. `ScrollView` composes this:

```tui
<ScrollView height={8} contentHeight={$log.length} focusable>
  {$log.map((line: string, i: number) => <Text key={i}>{line}</Text>)}
</ScrollView>
```

With `focusable`, arrows/PageUp/PageDown/Home/End scroll and clamp to
`contentHeight`. Without `contentHeight`, keyboard scrolling is disabled; a
controlled `scroll` still applies.

## Limits (v1)

- No scrollbars or follow-tail behavior; scroll is explicit.
- No sibling overflow clipping unless a box opts into `overflow="hidden"`.
- Text is plain; ANSI inside user text is not parsed and OSC-8 links are not
  represented.
- Layout has no cache; the Yoga tree is rebuilt per commit.
