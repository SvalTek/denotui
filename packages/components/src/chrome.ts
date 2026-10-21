/**
 * Application chrome: status bars and key hints. Both are thin compositions of
 * Row/Text and stretch to the parent width.
 */
import { component, type ComponentType, h } from "@denotui/runtime";
import { Text } from "./builtins.ts";
import { Row } from "./layout.ts";
import { asString } from "./util.ts";

export const StatusBar: ComponentType = component(
  "StatusBar",
  (props) => () =>
    h(Row, {
      width: props.width ?? "100%",
      padding: props.padding ?? [0, 1],
      bg: props.bg ?? "blue",
      fg: props.fg,
      justifyContent: "space-between",
      flexShrink: 0,
    }, [
      h(Text, { fg: props.fg ?? "white", bold: props.bold === true }, [
        asString(props.left, ""),
      ]),
      h(Text, { fg: props.fg ?? "white", dim: true }, [
        asString(props.right, ""),
      ]),
    ]),
);

interface HelpItem {
  key: string;
  label: string;
}

function helpItems(value: unknown): HelpItem[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (typeof entry === "object" && entry !== null) {
        const key = "key" in entry ? String(entry.key) : "";
        const label = "label" in entry ? String(entry.label) : "";
        return { key, label };
      }
      return { key: "", label: String(entry) };
    });
  }
  if (typeof value === "object") {
    return Object.entries(value).map(([key, label]) => ({
      key,
      label: String(label),
    }));
  }
  throw new TypeError("denotui: <HelpBar> items must be an array or object");
}

export const HelpBar: ComponentType = component("HelpBar", (props) => () => {
  const items = helpItems(props.items ?? []);
  const parts: unknown[] = [];
  items.forEach((item, index) => {
    if (index > 0) {
      parts.push(h(Text, { dim: true }, ["  "]));
    }
    parts.push(h(Text, { bold: true, fg: props.keyColor ?? "cyan" }, [
      item.key,
    ]));
    parts.push(h(Text, { dim: true, fg: props.labelColor }, [
      ` ${item.label}`,
    ]));
  });
  return h(Row, {
    width: props.width ?? "100%",
    padding: props.padding ?? [0, 1],
    bg: props.bg,
    flexShrink: 0,
  }, parts);
});

/** Presentational; kept for symmetry with HelpBar/StatusBar imports. */
export const Separator: ComponentType = component(
  "Separator",
  (props) => () => h(Text, { dim: true }, [asString(props.char, " · ")]),
);
