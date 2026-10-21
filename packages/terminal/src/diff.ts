/**
 * Frame diff: compare the front and back buffers and emit the minimal ANSI
 * operations (for v1: a cursor move per changed run plus collapsed SGR changes).
 *
 * Unchanged cells are skipped entirely, so an idle frame emits an empty string.
 */
import { CURSOR_HOME, cursorTo, RESET, sgr } from "./ansi.ts";
import type { CellBuffer } from "./buffer.ts";
import { type Style, stylesEqual } from "./style.ts";

function cellDiffers(
  front: CellBuffer,
  back: CellBuffer,
  column: number,
  row: number,
  force: boolean,
): boolean {
  if (force) return true;
  const next = back.cellAt(column, row);
  if (next.continuation) return true;
  if (column >= front.width || row >= front.height) return true;

  const current = front.cellAt(column, row);
  if (
    current.char !== next.char ||
    current.width !== next.width ||
    current.continuation ||
    !stylesEqual(current.style, next.style)
  ) {
    return true;
  }

  if (next.width === 2) {
    if (column + 1 >= back.width) return true;
    const nextTail = back.cellAt(column + 1, row);
    if (column + 1 >= front.width) return true;
    const currentTail = front.cellAt(column + 1, row);
    return !(nextTail.continuation && currentTail.continuation);
  }
  return false;
}

/**
 * Compare buffers and emit a frame. With `force`, every cell is written
 * (including blanks) — used after a resize instead of clearing the screen, so
 * there is no blank interval and old reflowed content is overwritten.
 */
export function diffBuffers(
  front: CellBuffer,
  back: CellBuffer,
  force = false,
): string {
  let output = "";
  let currentStyle: Style | null = null;
  let cursorRow = -1;
  let cursorColumn = -1;

  for (let row = 0; row < back.height; row++) {
    let column = 0;
    while (column < back.width) {
      if (!cellDiffers(front, back, column, row, force)) {
        column += back.cellAt(column, row).width;
        continue;
      }

      if (cursorRow !== row || cursorColumn !== column) {
        output += cursorTo(row + 1, column + 1);
      }

      while (column < back.width) {
        const cell = back.cellAt(column, row);
        if (cell.continuation) {
          column++;
          continue;
        }
        if (!cellDiffers(front, back, column, row, force)) break;
        if (!stylesEqual(currentStyle, cell.style)) {
          output += sgr(cell.style);
          currentStyle = cell.style;
        }
        output += cell.char;
        column += cell.width;
      }

      cursorRow = row;
      cursorColumn = column;
      if (column >= back.width) cursorRow = -1;
    }
  }

  if (output !== "") {
    if (currentStyle !== null) output += RESET;
    output += CURSOR_HOME;
  }
  return output;
}
