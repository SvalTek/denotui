/**
 * Conditional rendering as a component: `when` false renders nothing, and
 * function children are invoked only when the branch is taken.
 */
import { component, type ComponentType, Fragment, h } from "@denotui/runtime";
import { childrenOf } from "./util.ts";

export const Show: ComponentType = component("Show", (props) => () => {
  if (Boolean(props.when) === false) return h(Fragment, null, []);
  const children = childrenOf(props).map((child) =>
    typeof child === "function" ? (child as () => unknown)() : child
  );
  return h(Fragment, null, children);
});
