# Layout Reference

Package: `@denotui/layout`.

```ts
function layoutTree(
  source: LayoutInput,
  options: { width: number; height: number },
): LayoutNode[];

function paintLayout(buffer: CellBuffer, nodes: LayoutNode[]): void;
```

`LayoutInput` is structural: component/fragment nodes (transparent) plus
`element` (`type: "box" | "text"`, `props`, `children`) and `text` nodes.
Runtime nodes satisfy it without importing the runtime package.

## Output

```ts
type LayoutNode = LayoutBox | LayoutText;

interface LayoutBox {
  kind: "box";
  x: number;
  y: number;
  width: number;
  height: number;
  background: Color | null;
  border: BorderPlan | null;
  clip: boolean;
  content: { x: number; y: number; width: number; height: number };
  children: LayoutNode[];
}

interface LayoutText {
  kind: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[]; // already wrapped
  style: Style | null;
}
```

Text lines are wrapped during layout, so the painter never re-measures.
`content` is the box inner rect after border and padding; it is the clip region
when `clip` is true.

## Box props

Box styles map to Yoga. Defaults are noted; unknown props are ignored.

| Prop                                                                | Values                                                                 | Default               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------- |
| `direction`                                                         | row/column/row-reverse/column-reverse                                  | column                |
| `justifyContent`                                                    | start/center/end/space-between/space-around/space-evenly (or `flex-*`) | flex-start            |
| `alignItems`, `alignSelf`, `alignContent`                           | auto/start/center/end/stretch/baseline/space-*                         | auto/stretch per Yoga |
| `wrap`                                                              | nowrap/wrap/wrap-reverse                                               | nowrap                |
| `overflow`                                                          | visible/hidden/scroll                                                  | visible               |
| `display`                                                           | flex/none                                                              | flex                  |
| `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight` | number, `"50%"`, `"auto"`                                              | auto                  |
| `flexGrow`, `flexShrink`                                            | number                                                                 | 0/1 (Yoga)            |
| `flexBasis`                                                         | number, percent, auto                                                  | auto                  |
| `padding`, `margin`                                                 | number, `[v,h]`, `[t,r,b,l]`, object                                   | 0                     |
| `gap`                                                               | number, `[row,column]`, object                                         | 0                     |
| `border`                                                            | true/string style                                                      | none                  |
| `borderEdges`                                                       | array/object                                                           | all                   |
| `borderColor`                                                       | color                                                                  | null                  |
| `bg`                                                                | color                                                                  | null                  |
| `scrollX`, `scrollY`                                                | number                                                                 | 0                     |

Spacing arrays: 1 = all; 2 = vertical/horizontal; 4 = top/right/bottom/left.
Spacing objects accept `top`, `right`, `bottom`, `left`, `horizontal`,
`vertical`, `all`.

## Borders

Styles: `single`, `round`, `double`, `heavy`, `ascii`. Enabled edges set Yoga
border widths (one cell) and are painted on the box edges. Corners are drawn
only where both adjacent edges exist. Borders paint after children so scrolled
content cannot erase them.

## Text measurement

`normalizeText` normalizes newlines and expands tabs; `wrapText` wraps by
display cells; `textWidth` and `splitLines` use the same width definition as the
painter (`sliceColumns` is internal to painting).

Yoga measure modes are honored:

- `Exactly` fixes the size.
- `AtMost` clamps content.
- `Undefined` uses content size.

A text node measured at width W produces exactly the lines painted at that
width.

## Background inheritance

`paintLayout` carries the nearest ancestor box background into text and border
cells that have no `bg`; explicit `bg` wins. Foreground/attributes do not
inherit.

## Clipping and scroll

`overflow="hidden"` clips children to `content`; `scrollX`/`scrollY` shift child
positions inside that clip. Boxes without `hidden` do not clip children (parent
clips still apply).

## Paint order

1. box background (clipped to parent),
2. children (clipped to `content` when `hidden`, else parent),
3. box border.

## Limits

- No sibling overflow clipping by default.
- No layout cache; the Yoga tree is rebuilt per call.
- Fractional Yoga sizes are rounded to whole cells.
- Text style inheritance is background-only.

## Related

- [Layout guide](../guide/layout-and-styling.md)
- [Rendering internals](../contributing/rendering.md)
