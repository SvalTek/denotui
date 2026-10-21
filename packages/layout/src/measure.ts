/**
 * Shared text pipeline.
 *
 * Measurement and painting must agree on width, wrapping and whitespace, which
 * is the invariant the plan calls out (the Deno-Ink failure mode). Both sides
 * call these functions, so a wrapped line count from Yoga is exactly the number
 * of lines painted.
 */
import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";

/** Newlines normalized, tabs expanded once so measure and paint agree. */
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Slice by terminal columns, never splitting a wide glyph. */
export function sliceColumns(
  text: string,
  start: number,
  width: number,
): string {
  if (width <= 0 || start < 0) return "";
  let column = 0;
  let result = "";
  for (const { segment } of segmenter.segment(text)) {
    const cellWidth = stringWidth(segment);
    if (column + cellWidth <= start) {
      column += cellWidth;
      continue;
    }
    if (column < start) {
      column += cellWidth;
      continue;
    }
    if (column + cellWidth > start + width) break;
    result += segment;
    column += cellWidth;
  }
  return result;
}

/** Wrap a single text block at a column count; explicit newlines are kept. */
export function wrapText(text: string, width: number): string[] {
  const normalized = normalizeText(text);
  if (width <= 0) return [];
  return wrapAnsi(normalized, Math.floor(width), {
    hard: true,
    trim: false,
  }).split("\n");
}

/** Unwrapped lines (explicit newlines only). */
export function splitLines(text: string): string[] {
  return normalizeText(text).split("\n");
}

export function textWidth(lines: readonly string[]): number {
  let width = 0;
  for (const line of lines) width = Math.max(width, stringWidth(line));
  return width;
}
