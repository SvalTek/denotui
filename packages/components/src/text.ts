/**
 * Text-y components that compose Box/Text rather than introducing new paint
 * primitives.
 */
import { component, type ComponentType, h } from "@denotui/runtime";
import { Box, Text } from "./builtins.ts";
import { childrenOf, textChildren } from "./util.ts";

export const Badge: ComponentType = component("Badge", (props) => () => {
  const label = textChildren(props) || String(props.label ?? "");
  const bg = props.bg ?? "blue";
  return h(Box, {
    padding: props.padding ?? [0, 1],
    bg,
    flexShrink: 0,
    margin: props.margin,
  }, [
    h(Text, {
      fg: props.fg ?? "white",
      bg,
      bold: props.bold !== false,
      dim: props.dim === true,
    }, [label]),
  ]);
});

// Text-presentation/ASCII icons only: Windows Terminal renders U+2714 and
// friends as color emoji with a different cell width, which breaks alignment.
const VARIANTS: Record<string, { color: string; icon: string }> = {
  info: { color: "cyan", icon: "i" },
  success: { color: "green", icon: "+" },
  warning: { color: "yellow", icon: "!" },
  error: { color: "red", icon: "x" },
};

export const Alert: ComponentType = component("Alert", (props) => () => {
  const variant = typeof props.variant === "string" ? props.variant : "info";
  const { color, icon } = VARIANTS[variant] ?? VARIANTS.info;
  const title = props.title !== undefined
    ? String(props.title)
    : variant[0].toUpperCase() + variant.slice(1);
  return h(Box, {
    direction: "column",
    border: props.border ?? "round",
    borderColor: color,
    padding: props.padding ?? 1,
    gap: props.gap ?? 1,
    bg: props.bg,
    margin: props.margin,
  }, [
    h(Text, { fg: color, bold: true }, [`${icon} ${title}`]),
    ...childrenOf(props),
  ]);
});
