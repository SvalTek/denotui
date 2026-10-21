/**
 * Layout-oriented components. Row/Column are Box presets; Center/Spacer are
 * flex helpers; Divider and Panel use Box borders.
 */
import { component, type ComponentType, h } from "@denotui/runtime";
import { Box } from "./builtins.ts";
import { childrenOf, hostProps } from "./util.ts";

export const Row: ComponentType = component(
  "Row",
  (props) => () =>
    h(Box, { ...hostProps(props), direction: "row" }, childrenOf(props)),
);

export const Column: ComponentType = component(
  "Column",
  (props) => () =>
    h(Box, { ...hostProps(props), direction: "column" }, childrenOf(props)),
);

export const Center: ComponentType = component(
  "Center",
  (props) => () =>
    h(Box, {
      ...hostProps(props),
      justifyContent: props.justifyContent ?? "center",
      alignItems: props.alignItems ?? "center",
      flexGrow: props.flexGrow ?? 1,
    }, childrenOf(props)),
);

export const Spacer: ComponentType = component(
  "Spacer",
  () => () => h(Box, { flexGrow: 1 }, []),
);

export const Divider: ComponentType = component("Divider", (props) => () => {
  const vertical = props.orientation === "vertical" || props.vertical === true;
  return h(Box, {
    border: props.style ?? "single",
    borderColor: props.color ?? "gray",
    borderEdges: vertical ? ["left"] : ["top"],
    width: vertical ? 1 : undefined,
    height: vertical ? undefined : 1,
    flexShrink: 0,
    margin: props.margin,
  }, []);
});

export const Panel: ComponentType = component("Panel", (props) => () =>
  h(Box, {
    ...hostProps(props),
    border: props.border ?? true,
    borderColor: props.borderColor ?? "gray",
    padding: props.padding ?? 1,
    direction: props.direction ?? "column",
  }, childrenOf(props)));
