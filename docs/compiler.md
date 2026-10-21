# Compiler

`@denotui/compiler` turns a `.tui` source into a `.tui.ts` TypeScript module.
The pipeline has three stages, each in its own file so they can be tested apart:

```
.tui source
  │  npm:@astrojs/compiler parse()   (WASM)          → Astro AST
  ▼
src/parse.ts      AST → ComponentIR                  → framework-neutral IR
  ▼
src/codegen.ts    ComponentIR → TypeScript           → .tui.ts module
```

We use `parse()` only — never Astro's `transform()`. We are not producing HTML;
we interpret the syntax ourselves. See [`oddities.md`](./oddities.md) for the
exact node shapes this relies on.

## Public API (`mod.ts`)

| Function                     | Purpose                                              |
| ---------------------------- | ---------------------------------------------------- |
| `compile(source, options)`   | string → `{ code, ir, warnings }`                    |
| `compileFile(path)`          | read a file → same, plus `outputPath`                |
| `parseToIR(source, options)` | AST → IR without codegen (tests, tooling)            |
| `generate(ir, options)`      | IR → TypeScript (pure)                               |
| `rewriteTuiSpecifier(stmt)`  | `.tui` → `.tui.ts` on one import statement           |
| `build({ dir, check })`      | discover and compile every `*.tui` under a directory |

`compile`/`compileFile` accept `runtimeSpecifier` and `componentsSpecifier` to
change the import specifiers used in generated modules.

`compile`/`build`/`parseToIR` are async because the underlying parser is WASM.

## CLI

```
deno run -RWN packages/compiler/cli.ts build [dir] [--check]
```

- Defaults to the current directory; recurses, skipping `node_modules` and
  dot-directories.
- Idempotent: writes only when the generated code differs from what is on disk,
  so file mtimes stay stable for watch tooling.
- `--check` reports what would change without writing.
- `deno task build:examples` runs it over `examples/`.

## `deno compile` story

Generated `.tui.ts` files are the compiled artefact. Run the CLI before
bundling, then `deno compile` (with `--include` if generated files are outside
the entry graph). There is no runtime transform in v1 — deliberate, so that AOT
compilation stays possible.

## Frontmatter split

`splitFrontmatter()` (in `src/parse.ts`) asks `findImportSpans()` in
`src/scan.ts` for top-level import declarations:

- `scan.ts` is a small JS/TS lexer, not a parser: it knows strings, template
  literals (including `${...}` holes), comments, regex literals and bracket
  depth. Import detection therefore works in code position only.
- Multiline imports, side-effect imports, `import type`, import attributes and
  imports without a trailing semicolon are supported.
- `import(...)` and `import.meta` are not declarations and stay in the body;
  text that looks like an import inside a string, template literal or comment is
  ignored; an import nested inside another statement is ignored.
- Hoisted spans are blanked out of the body rather than deleted, so line numbers
  stay stable for future diagnostics.

The same scanner backs `rewriteReactive()`, which rewrites `$store` reads in
template expressions (see [`codegen.md`](./codegen.md)). Two features share one
notion of "inside a literal" instead of drifting apart.

## Diagnostics

`parseToIR()` returns `warnings` alongside the IR (the CLI prints them):

- dropped HTML comments;
- untyped arrow parameters in template expressions — generated modules are
  type-checked, so callbacks must be annotated (`(agent: Agent) => ...`). The
  scanner finds the arrow and names the parameter; it never rewrites the source.

Positions are still unavailable (Astro's position data is unreliable), so
warnings identify the file, not a line.
