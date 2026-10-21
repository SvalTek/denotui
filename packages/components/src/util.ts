/**
 * Shared helpers for bundled components.
 *
 * Components receive untyped props from generated modules, so these helpers do
 * the small amount of runtime narrowing the catalog needs. They intentionally
 * throw on malformed required props instead of rendering silence.
 */
import stringWidth from "string-width";

export function childrenOf(props: Record<string, unknown>): unknown[] {
  return Array.isArray(props.children) ? props.children : [];
}

export function textChildren(props: Record<string, unknown>): string {
  let text = "";
  for (const child of childrenOf(props)) {
    if (typeof child === "string" || typeof child === "number") text += child;
  }
  return text;
}

/** Copy props without `children`, which belongs to the vnode child list. */
export function hostProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key !== "children") result[key] = value;
  }
  return result;
}

export function asArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`denotui: ${name} must be an array`);
  }
  return value;
}

export function asString(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

export function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function labelOf(item: unknown): string {
  if (item === undefined || item === null) return "";
  if (typeof item === "string" || typeof item === "number") return String(item);
  if (typeof item === "object") {
    if ("label" in item) {
      const value = item.label;
      if (typeof value === "string" || typeof value === "number") {
        return String(value);
      }
    }
    if ("name" in item) {
      const value = item.name;
      if (typeof value === "string" || typeof value === "number") {
        return String(value);
      }
    }
    if ("title" in item) {
      const value = item.title;
      if (typeof value === "string" || typeof value === "number") {
        return String(value);
      }
    }
    if ("value" in item) {
      const value = item.value;
      if (typeof value === "string" || typeof value === "number") {
        return String(value);
      }
    }
  }
  return String(item);
}

export function itemKey(item: unknown, index: number): string {
  if (typeof item === "object" && item !== null) {
    if ("key" in item && item.key !== undefined && item.key !== null) {
      return `key:${String(item.key)}`;
    }
    if ("id" in item && item.id !== undefined && item.id !== null) {
      return `id:${String(item.id)}`;
    }
  }
  return `index:${index}`;
}

export function displayWidth(text: string): number {
  return stringWidth(text);
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Truncate to `width` cells, appending an ellipsis when clipped. */
export function truncate(text: string, width: number): string {
  if (width <= 0) return "";
  if (stringWidth(text) <= width) return text;
  let result = "";
  let used = 0;
  for (const { segment } of segmenter.segment(text)) {
    const cellWidth = stringWidth(segment);
    if (used + cellWidth > width - 1) break;
    result += segment;
    used += cellWidth;
  }
  return `${result}…`;
}

export function padEnd(text: string, width: number): string {
  const padding = width - stringWidth(text);
  return padding > 0 ? text + " ".repeat(padding) : text;
}

export function padStart(text: string, width: number): string {
  const padding = width - stringWidth(text);
  return padding > 0 ? " ".repeat(padding) + text : text;
}

/** Call a render-function child, if one was supplied. */
export function renderChild(
  props: Record<string, unknown>,
): ((...args: never[]) => unknown) | null {
  const render = props.render;
  return typeof render === "function"
    ? render as (...args: never[]) => unknown
    : null;
}
