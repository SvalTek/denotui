# Compiler Reference

Package: `@denotui/compiler` (build-time only; outside the app barrel).

## API

```ts
async function compile(
  source: string,
  options?: CompileOptions,
): Promise<CompileResult>;

async function compileFile(
  path: string,
  options?: CompileOptions,
): Promise<CompileResult & { outputPath: string }>;

async function build(options?: BuildOptions): Promise<BuildSummary>;

function parseToIR(
  source: string,
  options?: ParseOptions,
): Promise<ParseResult>;
function generate(ir: ComponentIRRoot, options?: CodegenOptions): string;
function rewriteTuiSpecifier(statement: string): string;
const CORE_COMPONENTS: readonly string[];
```

### `CompileOptions`

| Option                | Default             | Meaning                                   |
| --------------------- | ------------------- | ----------------------------------------- |
| `name`                | file basename       | Component name                            |
| `filename`            | —                   | Used for the name and diagnostic messages |
| `runtimeSpecifier`    | `@denotui/deno-tui` | Import specifier for primitives           |
| `componentsSpecifier` | same as runtime     | Import specifier for core components      |

`compile` returns `{ code, ir, warnings }`. `compileFile` adds `outputPath`
(`<path>.ts`).

### `BuildOptions`

| Option  | Default | Meaning                        |
| ------- | ------- | ------------------------------ |
| `dir`   | `"."`   | Directory to scan recursively  |
| `check` | false   | Report changes without writing |

`build` returns `{ written, unchanged }`; files are discovered by `*.tui`,
skipping `node_modules` and dot-directories. Output is written only when it
differs.

### IR helpers

`parseToIR` exposes the lowered `ComponentIRRoot` (frontmatter split, template
node tree, builtins) without codegen; `generate` is pure and deterministic.
`rewriteTuiSpecifier` rewrites `.tui` specifiers in one import statement.

## Core vocabulary

Auto-imported (26 names):

`Alert`, `Badge`, `Box`, `Button`, `Center`, `Checkbox`, `Column`, `Divider`,
`HelpBar`, `KeyValue`, `List`, `Map`, `Panel`, `ProgressBar`, `Row`,
`ScrollView`, `Select`, `Show`, `Spacer`, `Spinner`, `StatusBar`, `Table`,
`Tabs`, `Text`, `TextInput`, `Toggle`.

`CORE_COMPONENTS` exports this list; a test asserts every name exists in
`@denotui/components`. Other components (`Separator`, application components)
must be imported in frontmatter. Core names are reserved.

## Generated module

For `App.tui`:

```ts
import { Box, component, Fragment, h, Map, Text } from "@denotui/deno-tui";
import AgentRow from "./AgentRow.tui.ts";
import { $agents } from "./stores.ts";

export default component("App", (props, ctx) => {
  const title = "App";
  return () => h(Fragment, null, [/* ... */]);
});
```

- Factory body = frontmatter (once per instance); returned function = render.
- Every template expression is `ctx.expr(() => (...))`.
- Each `$store` read becomes `ctx.use($store)`.
- Runtime primitives and core components are merged into one app-barrel import
  by default. Set `runtimeSpecifier`/`componentsSpecifier` for a different
  layout.
- `.tui` imports are rewritten to `.tui.ts`.
- Output is deterministic.

## Diagnostics

| Condition                             | Result                                               |
| ------------------------------------- | ---------------------------------------------------- |
| Unterminated frontmatter fence        | Compile error with filename; nothing written         |
| JSX inside an attribute expression    | Compile error with the function-child workaround     |
| Untyped arrow parameter in a template | Warning naming the parameter                         |
| Dropped HTML comment                  | Warning                                              |
| Malformed frontmatter/JSON?           | — (frontmatter is TS, not validated beyond hoisting) |

Positions are not reliable, so errors identify the file rather than a line.

## CLI

```sh
denotui compile [dir] [--check]
denotui build [dir] [--check]      # alias
```

- `--check`: list files that would change, write nothing.
- Exit code 1 on compile errors with `error: <file>: <message>`.
- Permissions: `-RW`.
- Installed via `@denotui/compiler/cli` (global install or the project task).

## Internals

See [Compiler internals](../contributing/compiler-internals.md),
[Generated code](../contributing/codegen.md) and
[Oddities](../contributing/oddities.md).
