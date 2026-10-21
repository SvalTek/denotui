import { assert, assertEquals } from "@std/assert";
import { findImportSpans, rewriteReactive, tokenize } from "../src/scan.ts";
import { splitFrontmatter } from "../src/parse.ts";

Deno.test("rewriteReactive rewrites store reads in expressions", () => {
  assertEquals(rewriteReactive("$agents.length"), "ctx.use($agents).length");
  assertEquals(
    rewriteReactive("$a.length + $b.length"),
    "ctx.use($a).length + ctx.use($b).length",
  );
  assertEquals(rewriteReactive("$title"), "ctx.use($title)");
});

Deno.test("rewriteReactive leaves literals, comments and property names alone", () => {
  assertEquals(
    rewriteReactive(`"$agents" + '$title'`),
    `"$agents" + '$title'`,
  );
  assertEquals(rewriteReactive("/* $a */ 1 // $b"), "/* $a */ 1 // $b");
  assertEquals(rewriteReactive("obj.$store"), "obj.$store");
  assertEquals(rewriteReactive("obj?.$store"), "obj?.$store");
  assertEquals(rewriteReactive("/\\$a/"), "/\\$a/");
  assertEquals(rewriteReactive("x / $b"), "x / ctx.use($b)");
});

Deno.test("rewriteReactive rewrites inside template literal holes only", () => {
  assertEquals(
    rewriteReactive("`value: ${ $agents.length }`"),
    "`value: ${ ctx.use($agents).length }`",
  );
  assertEquals(rewriteReactive("`literal $agents`"), "`literal $agents`");
});

Deno.test("rewriteReactive leaves object keys and shorthand alone", () => {
  assertEquals(rewriteReactive("{ $a: 1 }"), "{ $a: 1 }");
  assertEquals(rewriteReactive("{ $a }"), "{ $a }");
  assertEquals(rewriteReactive("[{ $a }]"), "[{ $a }]");
});

Deno.test("tokenizer distinguishes regex from division", () => {
  const tokens = tokenize("a / b; const r = /a\\/b/g;");
  const kinds = tokens.map((token) => token.kind);
  assert(kinds.includes("regex"));
  assertEquals(tokens.filter((token) => token.kind === "regex").length, 1);
});

Deno.test("splitFrontmatter finds multiline and side-effect imports", () => {
  const raw = `
import {
  a,
  b,
} from "./mod.ts";
import "./side-effect.ts";
import type { T } from "./types.ts";
const x = 1;
`.trim();

  const { imports, body } = splitFrontmatter(raw);
  assertEquals(imports.length, 3);
  assert(imports[0].includes("a,\n  b,"));
  assertEquals(imports[1], 'import "./side-effect.ts";');
  assert(imports[2].startsWith("import type { T }"));
  assertEquals(body, "const x = 1;");
});

Deno.test("splitFrontmatter ignores import-like text in literals and comments", () => {
  const raw = `
// import a from "./no.ts";
/* import b from "./no.ts"; */
const text = "import c from './no.ts'";
const template = \`
import d from "./no.ts";
\`;
const meta = import.meta.url;
const lazy = () => import("./lazy.ts");
`.trim();

  const { imports, body } = splitFrontmatter(raw);
  assertEquals(imports, []);
  assert(body.includes("import.meta.url"));
  assert(body.includes('import("./lazy.ts")'));
});

Deno.test("splitFrontmatter ignores imports nested in statements", () => {
  const raw = `
function f() {
  import x from "./no.ts";
}
import real from "./yes.ts";
`.trim();

  const { imports } = splitFrontmatter(raw);
  assertEquals(imports, ['import real from "./yes.ts";']);
});

Deno.test("splitFrontmatter handles imports without a trailing semicolon", () => {
  const raw = `
import a from "./a.ts"
import b from "./b.ts"
const c = 1
`.trim();

  const { imports, body } = splitFrontmatter(raw);
  assertEquals(imports, [
    'import a from "./a.ts"',
    'import b from "./b.ts"',
  ]);
  assertEquals(body, "const c = 1");
});

Deno.test("findImportSpans skips dynamic import and import.meta", () => {
  assertEquals(findImportSpans("import.meta.url;\nimport('./x.ts');"), []);
});
