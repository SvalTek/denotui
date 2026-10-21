/**
 * Cell style model.
 *
 * Styles are carried by value through layout and paint; the terminal serializes
 * them to SGR. Colors are either an ANSI-256 palette index (0-255), a named
 * ANSI color (`"red"`, `"brightBlack"`), or a hex string (`"#ff8800"`, `"#f80"`).
 */
export type Color = string | number;

export interface Style {
  fg: Color | null;
  bg: Color | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
}

export const DEFAULT_STYLE: Style = Object.freeze({
  fg: null,
  bg: null,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  inverse: false,
});

export function stylesEqual(
  a: Style | null,
  b: Style | null,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.fg === b.fg &&
    a.bg === b.bg &&
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.inverse === b.inverse;
}
