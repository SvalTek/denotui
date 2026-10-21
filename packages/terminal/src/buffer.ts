/**
 * Cell grid used by the painter and the frame differ.
 *
 * Cells are mutable and reused: the renderer keeps two buffers (front/back) and
 * clears the back buffer each frame, so steady-state painting does not allocate
 * per cell. A wide glyph occupies a lead cell (`width: 2`) plus a continuation
 * cell, which keeps diffing and cursor math explicit.
 */
import stringWidth from "string-width";
import type { Style } from "./style.ts";

export interface Cell {
  char: string;
  width: 1 | 2;
  style: Style | null;
  /** True for the second half of a wide glyph. */
  continuation: boolean;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function blankCell(cell: Cell): void {
  cell.char = " ";
  cell.width = 1;
  cell.style = null;
  cell.continuation = false;
}

export class CellBuffer {
  readonly width: number;
  readonly height: number;
  readonly cells: Cell[];

  constructor(width: number, height: number) {
    this.width = Math.max(0, Math.floor(width));
    this.height = Math.max(0, Math.floor(height));
    this.cells = new Array(this.width * this.height);
    for (let index = 0; index < this.cells.length; index++) {
      this.cells[index] = {
        char: " ",
        width: 1,
        style: null,
        continuation: false,
      };
    }
  }

  cellAt(column: number, row: number): Cell {
    return this.cells[row * this.width + column];
  }

  clear(): void {
    for (const cell of this.cells) blankCell(cell);
  }

  fill(
    x: number,
    y: number,
    width: number,
    height: number,
    style: Style | null,
  ): void {
    const startX = Math.max(0, x);
    const startY = Math.max(0, y);
    const endX = Math.min(this.width, x + width);
    const endY = Math.min(this.height, y + height);
    for (let row = startY; row < endY; row++) {
      for (let column = startX; column < endX; column++) {
        const cell = this.cellAt(column, row);
        blankCell(cell);
        cell.style = style;
      }
    }
  }

  /**
   * Write plain text at (x, y), clipping at `maxWidth` columns. Returns the
   * number of columns consumed. Wide glyphs are never split at the clip edge.
   */
  putText(
    x: number,
    y: number,
    text: string,
    style: Style | null,
    maxWidth = this.width,
  ): number {
    if (y < 0 || y >= this.height) return 0;
    const limit = Math.min(this.width, x + Math.max(0, maxWidth));
    let column = x;

    for (const { segment } of segmenter.segment(text)) {
      if (segment === "\n") break;
      if (segment === "\r") continue;
      if (segment === "\t") {
        for (let i = 0; i < 4; i++) {
          column += this.putText(column, y, " ", style, limit - column);
        }
        continue;
      }

      const width = stringWidth(segment);
      if (width === 0) {
        this.attachCombining(column, y, segment);
        continue;
      }
      const cellWidth: 1 | 2 = width > 1 ? 2 : 1;
      if (column < 0) {
        column += cellWidth;
        continue;
      }
      if (column + cellWidth > limit) {
        if (cellWidth === 2 && column + 1 <= limit) {
          // A wide glyph with only one column left is dropped, not split.
          break;
        }
        break;
      }
      this.writeCell(column, y, segment, cellWidth, style);
      column += cellWidth;
    }

    return column - x;
  }

  private attachCombining(column: number, y: number, mark: string): void {
    let index = column - 1;
    if (index < 0) return;
    while (index > 0 && this.cellAt(index, y).continuation) index--;
    const cell = this.cellAt(index, y);
    if (!cell.continuation) cell.char += mark;
  }

  private writeCell(
    column: number,
    y: number,
    char: string,
    width: 1 | 2,
    style: Style | null,
  ): void {
    this.clearAt(column, y);
    if (width === 2) this.clearAt(column + 1, y);
    const cell = this.cellAt(column, y);
    cell.char = char;
    cell.width = width;
    cell.style = style;
    cell.continuation = false;
    if (width === 2) {
      const continuation = this.cellAt(column + 1, y);
      continuation.char = "";
      continuation.width = 1;
      continuation.style = style;
      continuation.continuation = true;
    }
  }

  /** Reset a cell, detaching it from any wide glyph it belongs to. */
  private clearAt(column: number, y: number): void {
    if (column < 0 || column >= this.width) return;
    const cell = this.cellAt(column, y);
    if (cell.continuation && column > 0) {
      blankCell(this.cellAt(column - 1, y));
    } else if (cell.width === 2 && column + 1 < this.width) {
      blankCell(this.cellAt(column + 1, y));
    }
    blankCell(cell);
  }
}
