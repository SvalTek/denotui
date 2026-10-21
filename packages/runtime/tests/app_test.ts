import { atom } from "nanostores";
import { assert, assertEquals } from "@std/assert";
import type { KeyEvent, TerminalSize } from "@denotui/terminal";
import { component, createApp, h } from "../mod.ts";
import { Box, Text } from "@denotui/components";

interface FakeScreen {
  readonly size: TerminalSize;
  readonly writes: string[];
  start(): void;
  stop(): void;
  write(frame: string): void;
  onResize(listener: (size: TerminalSize) => void): () => void;
  resize(columns: number, rows: number): void;
}

function createFakeScreen(columns: number, rows: number): FakeScreen {
  let size: TerminalSize = { columns, rows };
  let listener: ((size: TerminalSize) => void) | null = null;
  const writes: string[] = [];
  return {
    get size() {
      return size;
    },
    writes,
    start() {},
    stop() {},
    write(frame) {
      writes.push(frame);
    },
    onResize(next) {
      listener = next;
      return () => {
        listener = null;
      };
    },
    resize(nextColumns, nextRows) {
      size = { columns: nextColumns, rows: nextRows };
      listener?.(size);
    },
  };
}

interface FakeInput {
  start(onKey: (key: KeyEvent) => void): void;
  stop(): void;
  press(key: KeyEvent): void;
}

function createFakeInput(): FakeInput {
  let handler: ((key: KeyEvent) => void) | null = null;
  return {
    start(onKey) {
      handler = onKey;
    },
    stop() {
      handler = null;
    },
    press(key) {
      handler?.(key);
    },
  };
}

function stripAnsi(text: string): string {
  return text.replace(
    new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, "g"),
    "",
  );
}

function key(partial: Partial<KeyEvent>): KeyEvent {
  return {
    name: "",
    sequence: "",
    ctrl: false,
    meta: false,
    shift: false,
    text: null,
    ...partial,
  };
}

Deno.test("app paints on mount, on store update, on resize and stops on ctrl-c", () => {
  const $label = atom("Hello");
  const App = component(
    "App",
    (_props, ctx) => () =>
      h(Box, { direction: "column", padding: 1 }, [
        h(Text, { bold: true }, [ctx.use($label)]),
      ]),
  );

  const screen = createFakeScreen(20, 5);
  const input = createFakeInput();
  const app = createApp(App, {}, { screen, input });

  app.start();
  assert(
    stripAnsi(screen.writes.join("")).includes("Hello"),
    "mount frame has text",
  );

  $label.set("Bye");
  app.root.flush();
  const updateFrame = screen.writes[screen.writes.length - 1] ?? "";
  assert(stripAnsi(updateFrame).includes("Bye"), "update frame has new text");

  const beforeResize = screen.writes.length;
  screen.resize(10, 4);
  assert(screen.writes.length > beforeResize, "resize repaints");

  const beforeStop = screen.writes.length;
  input.press(key({ name: "c", ctrl: true, sequence: "\x03" }));
  $label.set("After");
  app.root.flush();
  assertEquals(screen.writes.length, beforeStop, "stopped app does not paint");

  app.stop();
});

Deno.test("app routes keys and the handler can stop the app", () => {
  const seen: string[] = [];
  const App = component(
    "App",
    () => () => h(Box, {}, [h(Text, null, ["menu"])]),
  );
  const screen = createFakeScreen(20, 3);
  const input = createFakeInput();
  const app = createApp(App, {}, {
    screen,
    input,
    onKey: (event) => {
      seen.push(event.name);
      if (event.name === "q") app.stop();
    },
  });
  app.start();

  input.press(key({ name: "down", sequence: "\x1b[B" }));
  assertEquals(seen, ["down"]);

  input.press(key({ name: "q", sequence: "q", text: "q" }));
  assertEquals(seen, ["down", "q"]);

  const before = screen.writes.length;
  app.root.flush();
  assertEquals(screen.writes.length, before, "stopped app does not paint");
  app.stop();
});
