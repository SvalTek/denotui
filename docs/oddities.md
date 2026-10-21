# Oddities & Intentional Workarounds

Things that surprised us while building the compiler, and the deliberate choices
made in response. Read this before changing `packages/compiler`.

## 1. Capitalised tags are `component` nodes; lowercase are `element` nodes

Astro classifies by first letter, not by a known-tag list. So `Box`, `Text` and
`Map` all arrive as `node.type === "component"`, **not** `"element"`. Codegen
therefore matches the core vocabulary by component _name_ (a `Record` in
`codegen.ts`), not by lowercase element tag. Do not assume `.tag` exists for
`Box`.

## 2. Astro v4 node types (and why `is.*` does not work)

Observed node types:
`root | frontmatter | component | element | text |
expression | attribute`. The
`is` helpers from `@astrojs/compiler/utils` (`is.tag`, `is.expression`, …) did
**not** match these nodes in v4 — every probe returned zero. We therefore switch
on `node.type` directly and keep our own narrow interfaces (`AstroNode` in
`src/parse.ts`). If you upgrade the compiler, re-run the probes before trusting
the helpers.

## 3. Attributes are an array of typed nodes

```
{ type: "attribute", kind: "quoted" | "expression" | "empty", name, value, raw }
```

Lowering maps these to `AttrIR`: `empty` → `true`, `expression` → raw JS source,
`quoted` → a `JSON.stringify`'d string. There is no keyed attribute map.

## 4. JSX inside `{...}` is already structured

This is the single most important discovery. An expression node whose value is
JSX does not hand us a string to re-parse — Astro gives us `expression.children`
containing `text` fragments interleaved with `component`/`element` nodes:

```
<expression>
  <text value="(agent) => ">
  <component name="AgentRow">
```

So we build a tiny JS printer (`stitchExpression` in `src/parse.ts`) that walks
these children and emits `h(...)` for nodes while preserving the literal text —
which is what keeps arrow params and surrounding operators intact. **We do not
write a JavaScript parser.** Do not "simplify" this by string-concatenating an
expression's `value`; the structured children are the reliable source.

## 5. Nanostores `atom()` reads `process.env.NODE_ENV`

Importing a Nanostores store evaluates `process.env.NODE_ENV`, which trips
Deno's permission system. Tests therefore run with a **narrow** permission:
`deno test -RE=NODE_ENV` (read + the single env var), never `-A`. Keep it
narrow.

## 6. Position data is unreliable

Astro's own docs state parse positions are incomplete/incorrect. We pass
`{ position: false }` and do not rely on positions for diagnostics yet. Compile
errors are reported by file, not line/column (future work).

## 7. Whitespace handling

Inter-tag whitespace is dropped by codegen: runs of text are trimmed and only
emitted when they contain non-whitespace. Terminal layout does not depend on
markup indentation. If you need significant whitespace between nodes, it must be
inside an expression.

## 8. `local/` is excluded from tooling

The experiment spikes under `local/` use loose casts (`Record<string, unknown>`)
and would fail `deno check`. They are gitignored and excluded via `exclude` /
`test.exclude` in the root `deno.json`. Do not move spike code into `packages/`
without tightening its types.

## 9. The scanner is a lexer, not a parser

`src/scan.ts` answers "is this position inside code?" for both reactive
rewriting and frontmatter import extraction. That means it shares a lexer's
limits:

- `/` is classified as regex or division from the previous significant token.
  After `)`/`]`/`}` an alphabet of operators, it is treated as division; a regex
  literal directly after a block `}` would be misread. Do not rely on regex
  literals at statement start in frontmatter.
- Object keys (`{ $x: 1 }`) and shorthand (`{ $x }`) are intentionally not
  rewritten to `ctx.use(...)`; rewriting shorthand would change the object key.
  Write `$x: ctx.use($x)` if a store value is needed as a property value.
- `$store` detection is name-based, matching the Nanostores convention. It is
  not a type check, and stores with other names need explicit `ctx.use(store)`.

If either feature grows past these limits, replace the scanner with a real
TypeScript parser; the rest of the pipeline (IR → codegen) is unaffected.

## 10. `Fragment` is always imported

The template root is always lowered to a fragment, so generated code always
references `Fragment` — including templates with no core components at all. Do
not "optimize" it back to conditional importing: the runtime import list is
always `component`, `h`, `Fragment`; core components are a second import from
`@denotui/components`, filtered from `ComponentIRRoot.builtins`.

## 11. Expression JSX is invisible to the component walk

Components written inside `{...}` live in the stitched expression source, not in
the IR tree. Lowering records them in `ComponentIRRoot.builtins` while
stitching; if you add a new place that emits `h(...)` from an Astro node, record
the name there too, or generated code will reference an unimported core
component.

## 12. Template callbacks must be typed

Generated modules are ordinary TypeScript and are type-checked by `deno check`
and `deno compile` (which the precompile strategy depends on). A template arrow
has no contextual parameter type — the compiler cannot know that `for={$agents}`
yields `Agent[]` — so an unannotated `(agent) => ...` becomes an implicit `any`
and fails `strict` checking.

The supported form is explicit: `{(agent: Agent) => <AgentRow agent={agent} />}`
with `import type { Agent }` in frontmatter. `findUntypedArrowParams()` in
`scan.ts` detects unannotated arrows and `parseToIR()` reports a warning, so the
feedback names the `.tui` file instead of a generated line. The compiler never
injects `any` and never suppresses checking: frontmatter errors must still
surface.

If you change expression stitching, keep parameter/default/rest syntax and type
annotations byte-for-byte; they are validated by the type checker, not by us.
