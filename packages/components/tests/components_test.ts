import { atom } from "nanostores";
import { assert, assertEquals, assertThrows } from "@std/assert";
import { component, createRoot, h, type Node } from "@denotui/runtime";
import { Box, Map as ListMap, Text } from "../mod.ts";

function textOf(node: Node): string {
  if (node.kind === "text") return node.value;
  return node.children.map(textOf).join("");
}

Deno.test("keyed Map rows keep instance identity across reorder", () => {
  interface Item {
    id: number;
    name: string;
  }
  const initial: Item[] = [
    { id: 1, name: "a" },
    { id: 2, name: "b" },
    { id: 3, name: "c" },
  ];
  const $items = atom<Item[]>(initial);
  let rows = 0;
  const Row = component("Row", (props) => {
    rows++;
    return () => h(Text, null, [String(props.name)]);
  });
  const List = component(
    "List",
    (_props, ctx) => () =>
      h(ListMap, { for: ctx.use($items) }, [
        (item: Item) => h(Row, { name: item.name }, []),
      ]),
  );

  const root = createRoot();
  root.mount(List);
  assertEquals(rows, 3);
  assertEquals(textOf(root.document), "abc");

  $items.set([
    { id: 3, name: "c" },
    { id: 1, name: "a" },
    { id: 2, name: "b" },
  ]);
  root.flush();
  assertEquals(rows, 3);
  assertEquals(textOf(root.document), "cab");
  root.unmount();
});

Deno.test("Box and Text forward props to intrinsic host nodes", () => {
  const App = component(
    "App",
    () => () =>
      h(Box, { direction: "column", padding: 1 }, [
        h(Text, { bold: true }, ["hi"]),
      ]),
  );
  const root = createRoot();
  root.mount(App);

  const app = root.document.children[0];
  assert(app.kind === "component");
  const box = app.children[0];
  assert(box.kind === "component");
  const host = box.children[0];
  assert(host.kind === "element");
  assertEquals(host.type, "box");
  assertEquals(host.props.direction, "column");
  assertEquals(host.props.padding, 1);
  assertEquals("children" in host.props, false);

  const textComponent = host.children[0];
  assert(textComponent.kind === "component");
  const textNode = textComponent.children[0];
  assert(textNode.kind === "element");
  assertEquals(textNode.type, "text");
  assertEquals(textOf(textNode), "hi");
  root.unmount();
});

Deno.test("Map requires an array in for", () => {
  const Bad = component("Bad", () => () => h(ListMap, { for: 1 }, []));
  const root = createRoot();
  assertThrows(() => root.mount(Bad), TypeError, "array in `for`");
});
