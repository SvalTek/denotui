/**
 * Text style props -> terminal style.
 *
 * Only `Text` carries a style in v1; `Box` contributes a background. Style
 * inheritance through boxes is a tracked tradeoff (docs/guide/layout-and-styling.md#background-inheritance).
 */
import type { Color, Style } from "@denotui/terminal";
import type { BorderPlan, BorderStyle } from "./types.ts";

export function readColor(value: unknown, prop: string): Color | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  throw new TypeError(
    `denotui: <${prop}> must be a color name, palette index or hex string`,
  );
}

export function readTextStyle(
  props: Record<string, unknown>,
): Style | null {
  const style: Style = {
    fg: readColor(props.fg, "Text fg"),
    bg: readColor(props.bg, "Text bg"),
    bold: props.bold === true,
    dim: props.dim === true,
    italic: props.italic === true,
    underline: props.underline === true,
    inverse: props.inverse === true,
  };
  const plain = style.fg === null && style.bg === null && !style.bold &&
    !style.dim && !style.italic && !style.underline && !style.inverse;
  return plain ? null : style;
}

const BORDER_STYLES: Record<string, true> = {
  single: true,
  round: true,
  double: true,
  heavy: true,
  ascii: true,
};

const EDGE_NAMES = ["top", "right", "bottom", "left"] as const;
type EdgeName = (typeof EDGE_NAMES)[number];

function borderEdges(value: unknown): Record<EdgeName, boolean> {
  const edges: Record<EdgeName, boolean> = {
    top: true,
    right: true,
    bottom: true,
    left: true,
  };
  if (value === undefined || value === null) return edges;

  if (Array.isArray(value)) {
    for (const name of EDGE_NAMES) edges[name] = false;
    for (const name of value) {
      if (typeof name !== "string" || !EDGE_NAMES.includes(name as EdgeName)) {
        throw new TypeError(
          `denotui: invalid borderEdges entry ${String(name)}`,
        );
      }
      edges[name as EdgeName] = true;
    }
    return edges;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const name of EDGE_NAMES) {
      if (typeof record[name] === "boolean") edges[name] = record[name];
    }
    return edges;
  }

  throw new TypeError("denotui: borderEdges must be an array or object");
}

export function readBorder(
  props: Record<string, unknown>,
): BorderPlan | null {
  const border = props.border;
  if (border === undefined || border === null || border === false) return null;

  let style: BorderStyle = "single";
  if (typeof border === "string") {
    if (BORDER_STYLES[border] !== true) {
      throw new TypeError(`denotui: unknown border style "${border}"`);
    }
    style = border as BorderStyle;
  } else if (border !== true) {
    throw new TypeError("denotui: border must be boolean or a style string");
  }

  const edges = borderEdges(props.borderEdges);
  if (!edges.top && !edges.right && !edges.bottom && !edges.left) return null;

  return {
    style,
    ...edges,
    color: readColor(props.borderColor, "Box borderColor"),
  };
}
