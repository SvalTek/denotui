import { atom } from "nanostores";
import { assert, assertEquals } from "@std/assert";
import { CellBuffer } from "@denotui/terminal";
import type { KeyEvent } from "@denotui/terminal";
import { layoutTree, paintLayout } from "@denotui/layout";
import { component, createRoot, h, type Node } from "@denotui/runtime";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Column,
  Divider,
  HelpBar,
  KeyValue,
  List,
  Panel,
  ProgressBar,
  Row,
  ScrollView,
  Select,
  Show,
  Spinner,
  StatusBar,
  Table,
  Tabs,
  Text,
  TextInput,
  Toggle,
} from "../mod.ts";

function textOf(node: Node): string {
  if (node.kind === "text") return node.value;
  return node.children.map(textOf).join("");
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

Deno.test("layout, panel, divider and row paint through the catalog", () => {
  const Dashboard = component(
    "Dashboard",
    () => () =>
      h(Panel, { border: "round", padding: 0 }, [
        h(Row, { gap: 1 }, [
          h(Text, { bold: true }, ["left"]),
          h(Text, null, ["right"]),
        ]),
        h(Divider, null, []),
        h(Column, null, [h(Text, null, ["footer"])]),
      ]),
  );

  const root = createRoot();
  root.mount(Dashboard);
  const tree = layoutTree(root.document, { width: 20, height: 8 });
  const buffer = new CellBuffer(20, 8);
  paintLayout(buffer, tree);

  const chars = buffer.cells.map((cell) => cell.char).join("");
  assert(chars.includes("left"), "row text painted");
  assert(chars.includes("right"));
  assert(chars.includes("footer"));
  assert(chars.includes("╭"));
  assert(chars.includes("─"), "divider painted");
  assert(chars.includes("│"));
  root.unmount();
});

Deno.test("Show renders only when true and invokes function children", () => {
  const App = component("App", () => () =>
    h(Column, null, [
      h(Show, { when: false }, [h(Text, null, ["hidden"])]),
      h(Show, { when: true }, [h(Text, null, ["shown"])]),
      h(Show, { when: true }, [() => h(Text, null, ["lazy"])]),
    ]));
  const root = createRoot();
  root.mount(App);
  assertEquals(textOf(root.document), "shownlazy");
  root.unmount();
});

Deno.test("badge, alert, tabs, status and help bars render their content", () => {
  const App = component("App", () => () =>
    h(Column, null, [
      h(Badge, { label: "new" }, []),
      h(Alert, { variant: "error", title: "Oops" }, [
        h(Text, null, ["details"]),
      ]),
      h(Tabs, { tabs: ["One", "Two"], active: 1 }, []),
      h(StatusBar, { left: "ready", right: "12ms" }, []),
      h(HelpBar, { items: [{ key: "q", label: "quit" }] }, []),
      h(KeyValue, { items: { mode: "demo" } }, []),
    ]));
  const root = createRoot();
  root.mount(App);
  const text = textOf(root.document);
  for (
    const expected of [
      "new",
      "✖ Oops",
      "details",
      "Two",
      "ready",
      "12ms",
      "q quit",
      "mode",
      "demo",
    ]
  ) {
    assert(text.includes(expected), `missing ${expected}`);
  }
  root.unmount();
});

Deno.test("List marks the selected row and aligns markers", () => {
  const App = component(
    "App",
    () => () => h(List, { items: ["a", "b", "c"], selected: 1 }, []),
  );
  const root = createRoot();
  root.mount(App);
  assertEquals(textOf(root.document), "  a❯ b  c");
  root.unmount();
});

Deno.test("Table pads and aligns cells", () => {
  const App = component("App", () => () =>
    h(Table, {
      columns: [
        { key: "name", title: "Name" },
        { key: "age", title: "Age", align: "right" },
      ],
      rows: [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 7 },
      ],
    }, []));
  const root = createRoot();
  root.mount(App);
  const text = textOf(root.document);
  assert(text.includes("Alice"));
  assert(text.includes("30"));
  assert(text.includes("Bob"));
  assert(text.includes(" 7"), "right-aligned age");
  root.unmount();
});

Deno.test("ProgressBar renders filled and empty cells", () => {
  const App = component(
    "App",
    () => () =>
      h(ProgressBar, { value: 50, max: 100, width: 6, label: "load" }, []),
  );
  const root = createRoot();
  root.mount(App);
  const text = textOf(root.document);
  assertEquals((text.match(/█/g) ?? []).length, 3);
  assertEquals((text.match(/░/g) ?? []).length, 3);
  assert(text.includes("50%"));
  root.unmount();
});

Deno.test("Spinner renders a frame with its label", () => {
  const App = component(
    "App",
    () => () => h(Spinner, { label: "working" }, []),
  );
  const root = createRoot();
  root.mount(App);
  const text = textOf(root.document);
  assert(text.includes("working"));
  assert(text.length > "working".length);
  root.unmount();
});

Deno.test("TextInput edits a controlled value and submits", () => {
  const $value = atom("");
  const submitted: string[] = [];
  const Form = component("Form", (_props, ctx) => () =>
    h(TextInput, {
      value: ctx.use($value),
      autoFocus: true,
      onChange: (value: string) => $value.set(value),
      onSubmit: (value: string) => submitted.push(value),
    }, []));

  const root = createRoot();
  root.mount(Form);
  root.dispatchKey(key({ name: "h", text: "h" }));
  root.dispatchKey(key({ name: "i", text: "i" }));
  root.flush();
  assertEquals($value.get(), "hi");
  assertEquals(textOf(root.document).startsWith("hi"), true);

  root.dispatchKey(key({ name: "backspace" }));
  root.flush();
  assertEquals($value.get(), "h");

  root.dispatchKey(key({ name: "return" }));
  assertEquals(submitted, ["h"]);
  root.unmount();
});

Deno.test("Select moves with arrows and commits on enter", () => {
  const changes: number[] = [];
  const selected: string[] = [];
  const App = component("App", () => () =>
    h(Select, {
      items: ["a", "b", "c"],
      autoFocus: true,
      onChange: (_item: unknown, index: number) => changes.push(index),
      onSelect: (item: unknown) => selected.push(String(item)),
    }, []));

  const root = createRoot();
  root.mount(App);
  root.dispatchKey(key({ name: "down" }));
  root.flush();
  assert(textOf(root.document).includes("❯ b"));

  root.dispatchKey(key({ name: "return" }));
  assertEquals(changes, [1]);
  assertEquals(selected, ["b"]);
  root.unmount();
});

Deno.test("Checkbox and Toggle react to space", () => {
  const $checked = atom(false);
  const $on = atom(false);
  const App = component("App", (_props, ctx) => () =>
    h(Column, null, [
      h(Checkbox, {
        checked: ctx.use($checked),
        label: "agree",
        autoFocus: true,
        onChange: (value: boolean) => $checked.set(value),
      }, []),
      h(Toggle, {
        on: ctx.use($on),
        label: "enabled",
        onChange: (value: boolean) => $on.set(value),
      }, []),
    ]));

  const root = createRoot();
  root.mount(App);
  assert(textOf(root.document).includes("[ ]"));
  assert(textOf(root.document).includes("agree"));

  root.dispatchKey(key({ name: "space", text: " " }));
  root.flush();
  assertEquals($checked.get(), true);
  assert(textOf(root.document).includes("[x]"));
  assert(textOf(root.document).includes("agree"));
  root.unmount();
});

Deno.test("Button activates on enter", () => {
  let presses = 0;
  const App = component(
    "App",
    () => () =>
      h(
        Button,
        { label: "Run", autoFocus: true, onPress: () => presses++ },
        [],
      ),
  );
  const root = createRoot();
  root.mount(App);
  root.dispatchKey(key({ name: "return" }));
  assertEquals(presses, 1);
  root.unmount();
});

Deno.test("ScrollView clips and scrolls its content", () => {
  const App = component(
    "App",
    () => () =>
      h(ScrollView, { height: 2, scroll: 1, contentHeight: 4 }, [
        h(Text, null, ["a"]),
        h(Text, null, ["b"]),
        h(Text, null, ["c"]),
        h(Text, null, ["d"]),
      ]),
  );
  const root = createRoot();
  root.mount(App);
  const tree = layoutTree(root.document, { width: 5, height: 5 });
  const buffer = new CellBuffer(5, 5);
  paintLayout(buffer, tree);
  assertEquals(buffer.cellAt(0, 0).char, "b");
  assertEquals(buffer.cellAt(0, 1).char, "c");
  assertEquals(buffer.cellAt(0, 2).char, " ");
  root.unmount();
});
