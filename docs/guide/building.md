# Building and Deploying

`.tui` files are compiled ahead of time to sibling `.tui.ts` modules. There is
no runtime transform in v1, which keeps `deno compile` viable.

## Compile

In an installed project:

```sh
deno task denotui:build
# equivalent:
deno run -RW @denotui/compiler/cli compile .
```

With a global CLI:

```sh
denotui compile [dir] [--check]
```

`build` is accepted as an alias for `compile`. The command:

- recurses from the directory (default `.`), skipping `node_modules` and
  dot-directories;
- writes only when the output differs, keeping mtimes stable;
- reports what would change with `--check`;
- requires read and write permission;
- reports compile errors with the source filename and exits nonzero. It does not
  write output for a file that fails.

## Generated files

For `App.tui`, the compiler writes `App.tui.ts`. It:

- imports `component`, `h`, `Fragment` and core components from the app barrel;
- imports application components from their `.tui.ts` siblings;
- hoists frontmatter imports;
- exports `component(name, (props, ctx) => { ...frontmatter; return render })`.

Add `*.tui.ts` to your `.gitignore` (the starter template does). For
`deno compile`, generated files are part of the import graph, so they are
bundled automatically; use `--include` if a generated file is not reachable from
the entry point.

## Type-check

```sh
deno check .
```

Generated modules are normal TypeScript. Template callback parameters must be
annotated because there is no contextual type; see
[Authoring](./authoring.md#typed-callbacks).

## Compile to a binary

```sh
deno task denotui:build
deno compile -A --include "*.tui.ts" main.ts
```

`-A` is appropriate for a TUI app (input, terminal size, environment); narrow
permissions are possible but require `--allow-env` for Nanostores and terminal
I/O. The resulting binary embeds the generated modules and dependencies.

## Diagnostics

| Symptom                                                     | Cause / fix                                                                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `unterminated frontmatter: missing closing "---" fence`     | The closing `---` is missing. Astro would otherwise treat the template as frontmatter.                                                 |
| `JSX inside an attribute expression is not supported`       | Move the JSX into a function child: `<Select>{(x) => <Row/>}</Select>`.                                                                |
| `untyped arrow parameter "x"` warning                       | Annotate the parameter: `(x: Item) => ...`, otherwise `deno check` fails on implicit `any`.                                            |
| `Cannot find name 'setFilter'` in generated code            | The frontmatter fence is misplaced (e.g. closed after imports), so helper code became template text. Move `---` after the helper body. |
| Core component name is already declared                     | Core names (`Box`, `Text`, `Input`, …) are reserved. Rename the application component.                                                 |
| Generated module imports fail to resolve                    | The app barrel is missing. `deno add jsr:@denotui/deno-tui` (the installer does this), or point codegen at your own specifier.         |
| Build reports `0 wrote, N unchanged` but `deno check` fails | Codegen succeeded; the generated TypeScript has an error. Run `deno check` and fix the source.                                         |

## Watch mode

Not implemented in v1. Run the compile command from a watcher of your choice;
output is idempotent and mtime-stable.

## Permissions

| Context              | Flags                                                       |
| -------------------- | ----------------------------------------------------------- |
| Installer (`deno x`) | `-A` (reads/writes config, spawns `deno add`/`deno create`) |
| Build task           | `-RW`                                                       |
| App (`start`)        | `-A` in the starter; narrow as needed                       |
| Global CLI install   | `-A` (bake with `--compile` if desired)                     |
