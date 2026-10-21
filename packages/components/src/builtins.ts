/**
 * Built-in components.
 *
 * These are ordinary components, not compiler intrinsics: generated modules
 * import them from `@denotui/components` by name, and the runtime engine has no
 * special knowledge of them. `Box` and `Text` forward props and children to the
 * host nodes `"box"` and `"text"`; `Map` implements the function-child contract.
 *
 * Keep this package additive: the compiler only auto-imports the fixed core
 * vocabulary (`Box`, `Text`, `Map`). New components are imported in frontmatter
 * like any other component, so the catalog can grow without compiler changes.
 */
import {
  component,
  type ComponentType,
  Fragment,
  h,
  isVNode,
} from "@denotui/runtime";
import { childrenOf, hostProps, itemKey } from "./util.ts";

export const Box: ComponentType = component(
  "Box",
  (props) => () => h("box", hostProps(props), childrenOf(props)),
);

export const Text: ComponentType = component(
  "Text",
  (props) => () => h("text", hostProps(props), childrenOf(props)),
);

/**
 * `for` holds the items; the first child is `(item, index) => vnode`.
 *
 * Rows are keyed by `item.id` / `item.key` when present, otherwise by index.
 * A returned vnode that already declares a key keeps it.
 */
export const Map: ComponentType = component("Map", (props) => () => {
  const items = props.for;
  if (!Array.isArray(items)) {
    throw new TypeError("denotui: <Map> requires an array in `for`");
  }
  const render = childrenOf(props)[0];
  if (typeof render !== "function") {
    throw new TypeError("denotui: <Map> requires a function child");
  }
  const call = render as (item: unknown, index: number) => unknown;
  const rows = items.map((item, index) =>
    withKey(call(item, index), itemKey(item, index))
  );
  return h(Fragment, null, rows);
});

function withKey(node: unknown, key: string): unknown {
  if (isVNode(node)) {
    return node.key === undefined || node.key === null
      ? { ...node, key }
      : node;
  }
  return h(Fragment, { key }, [node]);
}
