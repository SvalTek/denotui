import { assert, assertEquals, assertThrows } from "@std/assert";
import { Readable } from "node:stream";
import {
  attachKeypress,
  CellBuffer,
  CLEAR_SCREEN,
  CURSOR_HOME,
  diffBuffers,
  DISABLE_WRAP,
  ENABLE_WRAP,
  ENTER_ALT_SCREEN,
  EXIT_ALT_SCREEN,
  HIDE_CURSOR,
  type KeyEvent,
  normalizeKeypress,
  RESET,
  Screen,
  sgr,
  SHOW_CURSOR,
  type Style,
} from "../mod.ts";

const bold: Style = {
  fg: null,
  bg: null,
  bold: true,
  dim: false,
  italic: false,
  underline: false,
  inverse: false,
};

function tick(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 10);
  return promise;
}

Deno.test("sgr serializes attributes, named, palette and hex colors", () => {
  assertEquals(sgr(null), RESET);
  assertEquals(sgr(bold), RESET + "\x1b[1m");
  assertEquals(
    sgr({ ...bold, fg: "red", bg: "#102030" }),
    RESET + "\x1b[1;31;48;2;16;32;48m",
  );
  assertEquals(
    sgr({ ...bold, fg: "brightBlue", bg: 200 }),
    RESET + "\x1b[1;94;48;5;200m",
  );
  assertThrows(() => sgr({ ...bold, fg: "chartreuse" }), TypeError, "color");
  assertThrows(() => sgr({ ...bold, fg: 300 }), TypeError, "0-255");
});

Deno.test("buffer writes text, wide glyphs and combining marks", () => {
  const buffer = new CellBuffer(6, 1);
  buffer.putText(0, 0, "hi", null);
  assertEquals(buffer.cellAt(0, 0).char, "h");
  assertEquals(buffer.cellAt(1, 0).char, "i");

  buffer.clear();
  buffer.putText(0, 0, "日x", null);
  assertEquals(buffer.cellAt(0, 0).width, 2);
  assertEquals(buffer.cellAt(1, 0).continuation, true);
  assertEquals(buffer.cellAt(2, 0).char, "x");

  buffer.clear();
  buffer.putText(0, 0, "e\u0301", null);
  assertEquals(buffer.cellAt(0, 0).char, "e\u0301");
  assertEquals(buffer.cellAt(0, 0).width, 1);

  buffer.clear();
  buffer.putText(0, 0, "日本語", null, 3);
  assertEquals(buffer.cellAt(0, 0).char, "日");
  assertEquals(buffer.cellAt(1, 0).continuation, true);
  assertEquals(
    buffer.cellAt(2, 0).char,
    " ",
    "wide glyph must not split at clip",
  );
});

Deno.test("overwriting half of a wide glyph clears the whole glyph", () => {
  const buffer = new CellBuffer(4, 1);
  buffer.putText(0, 0, "日", null);
  buffer.putText(1, 0, "x", null);
  assertEquals(buffer.cellAt(0, 0).char, " ");
  assertEquals(buffer.cellAt(0, 0).width, 1);
  assertEquals(buffer.cellAt(1, 0).char, "x");
  assertEquals(buffer.cellAt(1, 0).continuation, false);
});

Deno.test("diff emits cursor moves and only changed cells", () => {
  const front = new CellBuffer(5, 2);
  const back = new CellBuffer(5, 2);
  assertEquals(diffBuffers(front, back), "");

  back.putText(0, 0, "hi", null);
  assertEquals(diffBuffers(front, back), "\x1b[1;1Hhi" + CURSOR_HOME);

  back.putText(0, 1, "ok", null);
  assert(
    diffBuffers(front, back).includes("\x1b[2;1Hok"),
    "second row needs its own cursor move",
  );

  const styled = new CellBuffer(5, 1);
  styled.putText(0, 0, "hi", bold);
  assertEquals(
    diffBuffers(front, styled),
    "\x1b[1;1H" + RESET + "\x1b[1mhi" + RESET + CURSOR_HOME,
  );
});

Deno.test("forced diff rewrites blank cells too", () => {
  const front = new CellBuffer(3, 1);
  front.putText(0, 0, "X", null);
  const back = new CellBuffer(3, 1);
  assertEquals(
    diffBuffers(front, back, true),
    "\x1b[1;1H   " + CURSOR_HOME,
  );
});

Deno.test("diff writes wide glyphs once and skips unchanged frames", () => {
  const front = new CellBuffer(4, 1);
  const back = new CellBuffer(4, 1);
  back.putText(0, 0, "日", null);
  assertEquals(diffBuffers(front, back), "\x1b[1;1H日" + CURSOR_HOME);
  assertEquals(diffBuffers(back, back), "");
});

Deno.test("screen enters/exits alternate screen and survives partial writes", () => {
  const chunks: string[] = [];
  const writer = {
    writeSync(data: Uint8Array): number {
      const text = new TextDecoder().decode(data);
      const take = Math.min(2, text.length);
      chunks.push(text.slice(0, take));
      return take;
    },
  };
  const screen = new Screen({
    writer,
    size: () => ({ columns: 10, rows: 2 }),
    resizePollMs: 1_000_000,
  });
  screen.start();
  screen.write("abcd");
  screen.stop();
  const output = chunks.join("");
  assertEquals(
    output,
    RESET + ENTER_ALT_SCREEN + CLEAR_SCREEN + HIDE_CURSOR + DISABLE_WRAP +
      "abcd" + RESET + ENABLE_WRAP + SHOW_CURSOR + EXIT_ALT_SCREEN,
  );
});

Deno.test("screen notifies resize listeners only on change", () => {
  let size = { columns: 10, rows: 2 };
  const screen = new Screen({
    writer: { writeSync: (data) => data.length },
    size: () => size,
    resizePollMs: 1_000_000,
  });
  const seen: string[] = [];
  screen.onResize((next) => seen.push(`${next.columns}x${next.rows}`));
  screen.start();
  screen.checkResize();
  assertEquals(seen, []);
  size = { columns: 20, rows: 3 };
  screen.checkResize();
  screen.checkResize();
  assertEquals(seen, ["20x3"]);
  screen.stop();
});

Deno.test("keypress stream is normalized", async () => {
  const input = new Readable({ read() {} });
  const events: KeyEvent[] = [];
  const detach = attachKeypress(input, (key) => events.push(key));

  input.push("\x1b[A");
  input.push("a");
  input.push("\x03");
  input.push("\x1b[1;5C");
  await tick();

  assertEquals(events.map((event) => event.name), ["up", "a", "c", "right"]);
  assertEquals(events[1].text, "a");
  assertEquals(events[2].ctrl, true);
  assertEquals(events[2].text, null);
  assertEquals(events[3].ctrl, true);

  detach();
  input.push("b");
  await tick();
  assertEquals(events.length, 4);
});

Deno.test("normalizeKeypress separates printable text from control keys", () => {
  assertEquals(normalizeKeypress(" ", { name: "space" }).text, " ");
  assertEquals(normalizeKeypress("\r", { name: "return" }).text, null);
  assertEquals(
    normalizeKeypress(undefined, { name: "escape", sequence: "\x1b" }).text,
    null,
  );
});
