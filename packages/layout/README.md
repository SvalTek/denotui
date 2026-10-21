# @denotui/layout

Yoga-backed flexbox layout, terminal text measurement, borders, clipping and
painting into a cell buffer for **denotui**.

```ts
import { layoutTree, paintLayout } from "@denotui/layout";

const positioned = layoutTree(tree, { width: 80, height: 24 });
paintLayout(buffer, positioned);
```

- Accepts a structural node tree (component/fragment transparent, `box`/`text`
  hosts).
- `Text` leaves use a shared wrap/measure pipeline so measured height equals
  painted lines.
- Backgrounds inherit through boxes; borders and scrolled content clip to the
  content box.

Docs: [`docs/reference/layout.md`](../../docs/reference/layout.md).
