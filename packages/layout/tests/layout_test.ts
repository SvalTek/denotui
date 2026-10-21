import { assert, assertEquals, assertThrows } from "@std/assert";
import { CellBuffer } from "@denotui/terminal";
import {
  type LayoutInput,
  type LayoutInputHost,
  type LayoutInputText,
  layoutTree,
  paintLayout,
} from "../mod.ts";

function text(
  value: string,
  props: Record<string, unknown> = {},
): LayoutInputHost {
  const child: LayoutInputText = { kind: "text", value };
  return { kind: "element", type: "text", props, children: [child] };
}

function box(
  props: Record<string, unknown>,
  children: LayoutInput[],
): LayoutInputHost {
  return { kind: "element", type: "box", props, children };
}

Deno.test("layout defaults to a column and includes padding", () => {
  const tree = layoutTree(
    box({ padding: 1 }, [text("a"), text("b")]),
    { width: 20, height: 6 },
  );
  assertEquals(tree.length, 1);
  const outer = tree[0];
  assert(outer.kind === "box");
  assertEquals(outer.x, 0);
  assertEquals(outer.y, 0);
  assertEquals(outer.width, 20);
  assertEquals(outer.height, 4);
  assertEquals(outer.children.length, 2);
  const [first, second] = outer.children;
  assert(first.kind === "text" && second.kind === "text");
  assertEquals([first.x, first.y], [1, 1]);
  assertEquals([second.x, second.y], [1, 2]);
  assertEquals(first.lines, ["a"]);
});

Deno.test("layout respects gap, fixed size and percentages", () => {
  const tree = layoutTree(
    box({ direction: "column", width: "50%", height: 5, gap: 1 }, [
      text("a"),
      text("b"),
    ]),
    { width: 20, height: 10 },
  );
  const outer = tree[0];
  assert(outer.kind === "box");
  assertEquals(outer.width, 10);
  assertEquals(outer.height, 5);
  const [first, second] = outer.children;
  assert(first.kind === "text" && second.kind === "text");
  assertEquals(first.y, 0);
  assertEquals(second.y, 2);
});

Deno.test("text wraps at its measured width and height matches painted lines", () => {
  const tree = layoutTree(
    box({ width: 10 }, [text("the quick brown fox")]),
    { width: 20, height: 10 },
  );
  const outer = tree[0];
  assert(outer.kind === "box");
  const run = outer.children[0];
  assert(run.kind === "text");
  assert(run.lines.length > 1);
  assertEquals(run.height, run.lines.length);
  for (const line of run.lines) assert(line.length <= 10);
});

Deno.test("text style props become a Style", () => {
  const tree = layoutTree(
    box({}, [text("hi", { bold: true, fg: "red", bg: 200 })]),
    { width: 10, height: 3 },
  );
  const run = tree[0].kind === "box" ? tree[0].children[0] : null;
  assert(run && run.kind === "text");
  assertEquals(run.style?.bold, true);
  assertEquals(run.style?.fg, "red");
  assertEquals(run.style?.bg, 200);
});

Deno.test("plain text under a box becomes an implicit text run", () => {
  const tree = layoutTree(
    box({}, [
      { kind: "text", value: "raw" },
      text("styled", { bold: true }),
    ]),
    { width: 20, height: 3 },
  );
  const outer = tree[0];
  assert(outer.kind === "box");
  const [implicit, styled] = outer.children;
  assert(implicit.kind === "text" && styled.kind === "text");
  assertEquals(implicit.lines, ["raw"]);
  assertEquals(implicit.style, null);
  assertEquals(styled.style?.bold, true);
});

Deno.test("fragments and components are transparent to layout", () => {
  const tree = layoutTree(
    {
      kind: "component",
      children: [
        {
          kind: "fragment",
          children: [
            box({}, [text("nested")]),
          ],
        },
      ],
    },
    { width: 20, height: 3 },
  );
  assertEquals(tree.length, 1);
  assert(tree[0].kind === "box");
});

Deno.test("unknown intrinsics and nested hosts in Text throw", () => {
  assertThrows(
    () =>
      layoutTree(
        { kind: "element", type: "div", props: {}, children: [] },
        { width: 10, height: 2 },
      ),
    TypeError,
    "unknown intrinsic",
  );
  assertThrows(
    () =>
      layoutTree(
        {
          kind: "element",
          type: "text",
          props: {},
          children: [box({}, [])],
        },
        { width: 10, height: 2 },
      ),
    TypeError,
    "only contain text",
  );
});

Deno.test("paintLayout draws text and box backgrounds", () => {
  const buffer = new CellBuffer(12, 4);
  const tree = layoutTree(
    box({ bg: "blue", flexGrow: 1 }, [text("hi", { bold: true })]),
    { width: 12, height: 4 },
  );
  paintLayout(buffer, tree);
  assertEquals(buffer.cellAt(0, 0).char, "h");
  assertEquals(buffer.cellAt(1, 0).char, "i");
  assertEquals(buffer.cellAt(0, 0).style?.bold, true);
  assertEquals(buffer.cellAt(0, 3).style?.bg, "blue");
  assertEquals(buffer.cellAt(2, 0).char, " ");
  assertEquals(buffer.cellAt(2, 0).style?.bg, "blue");
});

Deno.test("borders inset content and paint on all edges", () => {
  const tree = layoutTree(
    box({ border: "round", padding: 1 }, [text("x")]),
    { width: 10, height: 5 },
  );
  const outer = tree[0];
  assert(outer.kind === "box");
  assertEquals(outer.border?.style, "round");
  const run = outer.children[0];
  assert(run.kind === "text");
  assertEquals([run.x, run.y], [2, 2]);

  const buffer = new CellBuffer(10, 5);
  paintLayout(buffer, tree);
  assertEquals(buffer.cellAt(0, 0).char, "╭");
  assertEquals(buffer.cellAt(9, 0).char, "╮");
  assertEquals(buffer.cellAt(0, 4).char, "╰");
  assertEquals(buffer.cellAt(9, 4).char, "╯");
  assertEquals(buffer.cellAt(5, 0).char, "─");
  assertEquals(buffer.cellAt(0, 2).char, "│");
  assertEquals(buffer.cellAt(2, 2).char, "x");
});

Deno.test("overflow hidden clips children and scroll offsets shift content", () => {
  const tree = layoutTree(
    box({ height: 2, overflow: "hidden", scrollY: 1 }, [
      text("a"),
      text("b"),
      text("c"),
      text("d"),
    ]),
    { width: 5, height: 5 },
  );
  const outer = tree[0];
  assert(outer.kind === "box");
  assertEquals(outer.clip, true);
  assertEquals(outer.children.map((child) => child.y), [-1, 0, 1, 2]);

  const buffer = new CellBuffer(5, 5);
  paintLayout(buffer, tree);
  assertEquals(buffer.cellAt(0, 0).char, "b");
  assertEquals(buffer.cellAt(0, 1).char, "c");
  assertEquals(buffer.cellAt(0, 2).char, " ");
});
