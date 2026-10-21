import { assertEquals } from "@std/assert";
import { component, Fragment, h } from "@denotui/runtime";
import { Box as CoreBox } from "@denotui/components";
import type { LayoutBox } from "@denotui/layout";
import type { Cell } from "@denotui/terminal";

Deno.test("workspace members resolve by bare specifier", () => {
  const node = h("box", { direction: "column" }, ["hi"]);
  assertEquals(node.type, "box");
  assertEquals(node.props.direction, "column");
  assertEquals(node.key, undefined);
});

Deno.test("component() builds a callable type with a factory", () => {
  const type = component("Demo", (_props, _ctx) => () => h(Fragment, null, []));
  assertEquals(type.name, "Demo");
  assertEquals(typeof type.factory, "function");
  assertEquals(typeof Fragment, "symbol");
});

Deno.test("root umbrella re-exports member symbols", async () => {
  const root = await import("../mod.ts");
  assertEquals(typeof root.h, "function");
  assertEquals(CoreBox.name, "Box");
  assertEquals(typeof root.component, "function");
  const _box: LayoutBox = {
    kind: "box",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    background: null,
    border: null,
    clip: false,
    content: { x: 0, y: 0, width: 1, height: 1 },
    children: [],
  };
  const _cell: Cell = {
    char: " ",
    width: 1,
    style: null,
    continuation: false,
  };
  assertEquals(typeof root.compile, "function");
});
