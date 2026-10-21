/**
 * Paint a positioned layout tree into a cell buffer.
 *
 * Boxes contribute a background and optional border. A box with
 * `overflow: "hidden"` clips its children; text is clipped to its own box and
 * to the current clip rectangle. Box props `scrollX`/`scrollY` shift children
 * inside that clip (ScrollView).
 */
import type { CellBuffer, Style } from "@denotui/terminal";
import type {
  BorderPlan,
  BorderStyle,
  LayoutBox,
  LayoutNode,
} from "./types.ts";
import { sliceColumns } from "./measure.ts";

interface Clip {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersect(a: Clip, b: Clip): Clip {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    x,
    y,
    width: Math.min(a.x + a.width, b.x + b.width) - x,
    height: Math.min(a.y + a.height, b.y + b.height) - y,
  };
}

interface BorderChars {
  horizontal: string;
  vertical: string;
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
}

const BORDER_CHARS: Record<BorderStyle, BorderChars> = {
  single: {
    horizontal: "─",
    vertical: "│",
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
  },
  round: {
    horizontal: "─",
    vertical: "│",
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
  },
  double: {
    horizontal: "═",
    vertical: "║",
    topLeft: "╔",
    topRight: "╗",
    bottomLeft: "╚",
    bottomRight: "╝",
  },
  heavy: {
    horizontal: "━",
    vertical: "┃",
    topLeft: "┏",
    topRight: "┓",
    bottomLeft: "┗",
    bottomRight: "┛",
  },
  ascii: {
    horizontal: "-",
    vertical: "|",
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
  },
};

function paintBorder(
  buffer: CellBuffer,
  box: LayoutBox,
  clip: Clip,
): void {
  const plan: BorderPlan | null = box.border;
  if (plan === null || box.width <= 0 || box.height <= 0) return;
  const chars = BORDER_CHARS[plan.style];
  const style: Style = {
    fg: plan.color,
    bg: null,
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    inverse: false,
  };
  const draw = (column: number, row: number, char: string): void => {
    if (
      column < clip.x || column >= clip.x + clip.width ||
      row < clip.y || row >= clip.y + clip.height
    ) {
      return;
    }
    buffer.putText(column, row, char, style, 1);
  };
  const right = box.x + box.width - 1;
  const bottom = box.y + box.height - 1;

  if (plan.top) {
    for (
      let column = box.x + (plan.left ? 1 : 0);
      column <= right - (plan.right ? 1 : 0);
      column++
    ) {
      draw(column, box.y, chars.horizontal);
    }
  }
  if (plan.bottom) {
    for (
      let column = box.x + (plan.left ? 1 : 0);
      column <= right - (plan.right ? 1 : 0);
      column++
    ) {
      draw(column, bottom, chars.horizontal);
    }
  }
  if (plan.left) {
    for (
      let row = box.y + (plan.top ? 1 : 0);
      row <= bottom - (plan.bottom ? 1 : 0);
      row++
    ) {
      draw(box.x, row, chars.vertical);
    }
  }
  if (plan.right) {
    for (
      let row = box.y + (plan.top ? 1 : 0);
      row <= bottom - (plan.bottom ? 1 : 0);
      row++
    ) {
      draw(right, row, chars.vertical);
    }
  }

  if (box.width > 1 && box.height > 1) {
    if (plan.top && plan.left) draw(box.x, box.y, chars.topLeft);
    if (plan.top && plan.right) draw(right, box.y, chars.topRight);
    if (plan.bottom && plan.left) draw(box.x, bottom, chars.bottomLeft);
    if (plan.bottom && plan.right) draw(right, bottom, chars.bottomRight);
  }
}

function backgroundStyle(background: string | number): Style {
  return {
    fg: null,
    bg: background,
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    inverse: false,
  };
}

export function paintLayout(
  buffer: CellBuffer,
  nodes: readonly LayoutNode[],
): void {
  paintNodes(buffer, nodes, {
    x: 0,
    y: 0,
    width: buffer.width,
    height: buffer.height,
  });
}

function paintNodes(
  buffer: CellBuffer,
  nodes: readonly LayoutNode[],
  clip: Clip,
): void {
  for (const node of nodes) {
    if (node.kind === "box") {
      const boxClip = intersect(clip, {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      });
      if (node.background !== null && boxClip.width > 0 && boxClip.height > 0) {
        buffer.fill(
          boxClip.x,
          boxClip.y,
          boxClip.width,
          boxClip.height,
          backgroundStyle(node.background),
        );
      }
      paintBorder(buffer, node, clip);
      paintNodes(
        buffer,
        node.children,
        node.clip ? boxClip : clip,
      );
      continue;
    }

    const top = Math.max(node.y, clip.y);
    const bottom = Math.min(node.y + node.height, clip.y + clip.height);
    const left = Math.max(node.x, clip.x);
    const right = Math.min(node.x + node.width, clip.x + clip.width);
    if (right <= left || bottom <= top) continue;

    for (let row = top; row < bottom; row++) {
      const line = node.lines[row - node.y];
      if (line === undefined) break;
      buffer.putText(
        left,
        row,
        sliceColumns(line, left - node.x, right - left),
        node.style,
        right - left,
      );
    }
  }
}
