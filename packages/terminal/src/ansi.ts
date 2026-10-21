/**
 * ANSI/VT sequences used by the renderer.
 *
 * Deliberately small and local: the sequences we need are stable and covered by
 * tests, while the parts that actually need design (cell diffing and SGR state
 * tracking) have no trustworthy off-the-shelf equivalent that fits this model.
 * Target terminals are modern VT terminals (Windows Terminal, iTerm, Alacritty,
 * kitty, GNOME Terminal, …); legacy conhost is out of scope.
 */
import type { Color, Style } from "./style.ts";

export const ENTER_ALT_SCREEN = "\x1b[?1049h";
export const EXIT_ALT_SCREEN = "\x1b[?1049l";
export const HIDE_CURSOR = "\x1b[?25l";
export const SHOW_CURSOR = "\x1b[?25h";
export const CLEAR_SCREEN = "\x1b[2J\x1b[H";
export const RESET = "\x1b[0m";

export function cursorTo(row: number, column: number): string {
  return `\x1b[${row};${column}H`;
}

/** Named ANSI colors, 0-15. Keys are lowercased before lookup. */
const NAMED_COLORS: Record<string, number> = {
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  brightblack: 8,
  gray: 8,
  grey: 8,
  brightred: 9,
  brightgreen: 10,
  brightyellow: 11,
  brightblue: 12,
  brightmagenta: 13,
  brightcyan: 14,
  brightwhite: 15,
};

function colorCode(color: Color, background: boolean): string {
  if (typeof color === "number") {
    if (!Number.isInteger(color) || color < 0 || color > 255) {
      throw new TypeError(`denotui: palette color must be 0-255, got ${color}`);
    }
    return `${background ? 48 : 38};5;${color}`;
  }

  const value = color.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const expanded = hex.length === 3
      ? hex.split("").map((char) => char + char).join("")
      : hex;
    if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
      throw new TypeError(`denotui: invalid hex color "${color}"`);
    }
    const red = parseInt(expanded.slice(0, 2), 16);
    const green = parseInt(expanded.slice(2, 4), 16);
    const blue = parseInt(expanded.slice(4, 6), 16);
    return `${background ? 48 : 38};2;${red};${green};${blue}`;
  }

  const named = NAMED_COLORS[value.toLowerCase()];
  if (named === undefined) {
    throw new TypeError(`denotui: unknown color "${color}"`);
  }
  if (named < 8) return String((background ? 40 : 30) + named);
  return String((background ? 100 : 90) + named - 8);
}

/** SGR sequence for a style; `null` means the terminal default. */
export function sgr(style: Style | null): string {
  if (style === null) return RESET;
  const codes: string[] = [];
  if (style.bold) codes.push("1");
  if (style.dim) codes.push("2");
  if (style.italic) codes.push("3");
  if (style.underline) codes.push("4");
  if (style.inverse) codes.push("7");
  if (style.fg !== null) codes.push(colorCode(style.fg, false));
  if (style.bg !== null) codes.push(colorCode(style.bg, true));
  return codes.length ? `\x1b[${codes.join(";")}m` : RESET;
}
