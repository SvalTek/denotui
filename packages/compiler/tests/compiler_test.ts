import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { compile, parseToIR, rewriteTuiSpecifier } from "../mod.ts";
import { generate } from "../src/codegen.ts";

const agentZoo = await Deno.readTextFile(
  new URL("./fixtures/AgentZoo.tui", import.meta.url),
);
const fragment = await Deno.readTextFile(
  new URL("./fixtures/Fragment.tui", import.meta.url),
);

Deno.test("parseToIR splits frontmatter imports from body", async () => {
  const { ir } = await parseToIR(agentZoo, { name: "AgentZoo" });
  assertEquals(ir.frontmatter.imports.length, 3);
  assertStringIncludes(ir.frontmatter.imports[0], 'from "./stores.ts"');
  assertStringIncludes(ir.frontmatter.body, 'const title = "AgentZoo"');
  assert(!ir.frontmatter.body.includes("import"));
});

Deno.test("parseToIR lowers the template to a fragment root", async () => {
  const { ir } = await parseToIR(agentZoo, { name: "AgentZoo" });
  assertEquals(ir.root.kind, "fragment");
  const box = ir.root.children.find((n) => n.kind === "component");
  assert(box && box.kind === "component");
  // Astro classifies capitalised tags (Box/Text/Map) as components, not elements.
  assertEquals(box.name, "Box");
  assert(
    box.attrs.some((a) => a.name === "direction" && a.value === '"column"'),
  );
  assert(box.attrs.some((a) => a.name === "padding" && a.value === "1"));
});

Deno.test("component children that are functions stay structured", async () => {
  const { ir } = await parseToIR(agentZoo, { name: "AgentZoo" });
  const box = ir.root.children[0];
  assert(box.kind === "component");
  const mapNode = box.children.find(
    (n) => n.kind === "component" && n.name === "Map",
  );
  assert(mapNode && mapNode.kind === "component");
  assertEquals(mapNode.name, "Map");
  const arrowChild = mapNode.children.find((n) => n.kind === "expr");
  assert(arrowChild && arrowChild.kind === "expr");
  assertStringIncludes(arrowChild.source, "(agent: Agent) =>");
  assertStringIncludes(arrowChild.source, "h(AgentRow, { agent: agent }, [])");
});

Deno.test("codegen wraps template expressions in ctx.expr and ctx.use", async () => {
  const { code } = await compile(agentZoo, { name: "AgentZoo" });
  assertStringIncludes(code, "ctx.expr(() => (title))");
  assertStringIncludes(code, "ctx.expr(() => (ctx.use($agents).length))");
  assertStringIncludes(code, "for: ctx.expr(() => (ctx.use($agents)))");
  assertStringIncludes(code, "ctx.expr(() => (1))");
});

Deno.test("codegen hoists imports and rewrites .tui specifiers", async () => {
  const { code } = await compile(agentZoo, { name: "AgentZoo" });
  assertStringIncludes(code, 'from "./AgentRow.tui.ts"');
  assertStringIncludes(code, 'from "./stores.ts"');
  assert(!code.includes('"./AgentRow.tui"'));
  // runtime import comes first, then hoisted frontmatter imports.
  assert(code.indexOf("import { ") < code.indexOf('from "./stores.ts"'));
});

Deno.test("codegen injects the intrinsic components actually used", async () => {
  const { code } = await compile(agentZoo, { name: "AgentZoo" });
  assertStringIncludes(code, "Box");
  assertStringIncludes(code, "Text");
  assertStringIncludes(code, "Map");
  assertStringIncludes(code, "Fragment");
});

Deno.test("codegen factory body runs once and returns a render function", async () => {
  const { code } = await compile(agentZoo, { name: "AgentZoo" });
  assertStringIncludes(code, 'component("AgentZoo", (props, ctx) => {');
  assertStringIncludes(code, "return () => h(Fragment,");
});

Deno.test("fragment fixture round-trips through codegen snapshot shape", async () => {
  const { code } = await compile(fragment, { name: "Fragment" });
  assertStringIncludes(code, "ctx.expr(() => (label))");
  assertStringIncludes(code, '"plain"');
  assertStringIncludes(code, 'component("Fragment"');
});

Deno.test("rewriteTuiSpecifier leaves non-tui specifiers untouched", () => {
  assertEquals(
    rewriteTuiSpecifier('import x from "./a.tui";'),
    'import x from "./a.tui.ts";',
  );
  assertEquals(
    rewriteTuiSpecifier('import x from "./a.ts";'),
    'import x from "./a.ts";',
  );
});

Deno.test("generate is deterministic (idempotent output)", async () => {
  const parsed = await parseToIR(agentZoo, { name: "AgentZoo" });
  assertEquals(generate(parsed.ir), generate(parsed.ir));
});

Deno.test("parse warnings surface for dropped comments", async () => {
  const { warnings } = await parseToIR("<!-- hi -->\n<Text>x</Text>");
  assertEquals(warnings.length, 1);
  assertStringIncludes(warnings[0], "comment");
});

Deno.test("codegen imports intrinsics used inside JSX expressions", async () => {
  const source = `
---
const items = ["a"];
---
<Box>{items.map((item: string) => <Text>{item}</Text>)}</Box>
`;
  const { code } = await compile(source, { name: "Nested" });
  assertStringIncludes(
    code,
    'import { Box, Fragment, Text, component, h } from "@denotui/deno-tui"',
  );
  assertStringIncludes(code, "h(Text,");
});

Deno.test("codegen rewrites store reads inside nested JSX expressions", async () => {
  const source = `
---
import { $agents } from "./stores.ts";
---
<Box>{$agents.map((agent: { name: string }) => <Text>{agent.name}</Text>)}</Box>
`;
  const { code } = await compile(source, { name: "Nested" });
  assertStringIncludes(
    code,
    "ctx.expr(() => (ctx.use($agents).map((agent: { name: string }) => h(Text,",
  );
});

Deno.test("codegen quotes attribute names that are not identifiers", async () => {
  const { code } = await compile(
    '<Box data-x="1" aria-label="row" />',
    { name: "Attrs" },
  );
  assertStringIncludes(code, '"data-x": "1"');
  assertStringIncludes(code, '"aria-label": "row"');
});

Deno.test("untyped template arrows warn about missing annotations", async () => {
  const source = `
---
const items = ["a"];
---
<Box>{items.map((item) => <Text>{item}</Text>)}</Box>
`;
  const { warnings } = await parseToIR(source, { name: "Warn" });
  assertEquals(warnings.length, 1);
  assertStringIncludes(warnings[0], 'untyped arrow parameter "item"');
  assertStringIncludes(warnings[0], "(item: Type) =>");
});

Deno.test("typed template arrows produce no warning", async () => {
  const source = `
---
const items = ["a"];
---
<Box>{items.map((item: string) => <Text>{item}</Text>)}</Box>
`;
  const { warnings } = await parseToIR(source, { name: "Typed" });
  assertEquals(warnings, []);
});

Deno.test("generated code only imports the core components it uses", async () => {
  const { code } = await compile("<Text>hi</Text>", { name: "OnlyText" });
  assertStringIncludes(
    code,
    'import { Fragment, Text, component, h } from "@denotui/deno-tui"',
  );
  assert(!code.includes("Box"), "Box should not be imported");
  assert(!code.includes("Map"), "Map should not be imported");
});

Deno.test("components import specifier is configurable", async () => {
  const { code } = await compile("<Box />", {
    name: "Custom",
    componentsSpecifier: "./design-system.ts",
  });
  assertStringIncludes(code, 'from "./design-system.ts"');
});

Deno.test("runtime-only templates still import Fragment", async () => {
  const { code } = await compile("plain text", { name: "Plain" });
  assertStringIncludes(
    code,
    'import { Fragment, component, h } from "@denotui/deno-tui"',
  );
  assert(!code.includes("@denotui/components"));
});

Deno.test("attribute expressions starting with a string still subscribe", async () => {
  const { code } = await compile(
    '<StatusBar left={"Count: " + $count} />',
    { name: "Attr" },
  );
  assertStringIncludes(
    code,
    'left: ctx.expr(() => ("Count: " + ctx.use($count)))',
  );
});

Deno.test("pure string attribute expressions stay unwrapped", async () => {
  const { code } = await compile("<StatusBar left={'plain'} />", {
    name: "Attr",
  });
  assertStringIncludes(code, "left: 'plain'");
  assert(!code.includes("ctx.expr(() => ('plain'))"));
});

Deno.test("JSX in attribute expressions is rejected with guidance", async () => {
  await assertRejects(
    () => compile("<Select render={(x: string) => <Text>{x}</Text>} />"),
    Error,
    "JSX inside an attribute expression",
  );
});

Deno.test("unterminated frontmatter is a compile error", async () => {
  const source = `---
const x = 1;
<Text>{x}</Text>`;
  await assertRejects(
    () => compile(source, { filename: "Broken.tui" }),
    Error,
    'Broken.tui: unterminated frontmatter: missing closing "---"',
  );
});

Deno.test("frontmatter with a closing fence still compiles", async () => {
  const source = `---
const x = 1;
---

<Text>{x}</Text>`;
  const { code } = await compile(source, { name: "Closed" });
  assertStringIncludes(code, "const x = 1;");
  assertStringIncludes(code, "ctx.expr(() => (x))");
});
