/**
 * Layout input and output types.
 *
 * The input side is structural on purpose: it mirrors the runtime's node tree
 * (`component | fragment | element | text`) without importing
 * `@denotui/runtime`, so `@denotui/layout` stays a leaf that accepts any tree
 * with the same shape. Component and fragment nodes are transparent; only
 * `element` and `text` become boxes and text runs.
 */
import type { Color, Style } from "@denotui/terminal";

export interface LayoutInputText {
  readonly kind: "text";
  readonly value: string;
}

export interface LayoutInputHost {
  readonly kind: "element";
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: LayoutInput[];
}

export interface LayoutInputContainer {
  readonly kind: "component" | "fragment";
  readonly children: LayoutInput[];
}

export type LayoutInput =
  | LayoutInputText
  | LayoutInputHost
  | LayoutInputContainer;

export type BorderStyle = "single" | "round" | "double" | "heavy" | "ascii";

export interface BorderPlan {
  readonly style: BorderStyle;
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly left: boolean;
  readonly color: Color | null;
}

export interface LayoutBox {
  readonly kind: "box";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly background: Color | null;
  readonly border: BorderPlan | null;
  /** Clip children to this box (overflow hidden). */
  readonly clip: boolean;
  readonly children: LayoutNode[];
}

export interface LayoutText {
  readonly kind: "text";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly lines: string[];
  readonly style: Style | null;
}

export type LayoutNode = LayoutBox | LayoutText;

export interface LayoutOptions {
  readonly width: number;
  readonly height: number;
}
