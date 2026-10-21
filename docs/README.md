# denotui — Developer Documentation

Essential documentation for contributors to the framework itself. This is not a
user guide; it explains the syntax we accept, what the compiler does with it,
and the non-obvious constraints we work under.

Read in this order:

1. [`syntax.md`](./syntax.md) — the `.tui` authoring format and its rules.
2. [`compiler.md`](./compiler.md) — how a `.tui` file becomes a `.tui.ts`
   module.
3. [`codegen.md`](./codegen.md) — the exact shape of generated code and why.
4. [`rendering.md`](./rendering.md) — layout, cells, diffing, screen and input.
5. [`installer.md`](./installer.md) — the consumer installer and starter
   template.
6. [`oddities.md`](./oddities.md) — gotchas, intentional workarounds, and the
   upstream behaviour we depend on.

Design-level documents live in `local/` (`PLAN.md`, `ARCHITECTURE.md`) and are
gitignored; they are the source of truth for the roadmap, not for day-to-day
authoring rules.

## Package layout

```
packages/compiler  @denotui/compiler    .tui -> IR -> .tui.ts + CLI
packages/runtime   @denotui/runtime     component model, vnodes, reactivity, app loop
packages/components @denotui/components bundled UI components (Box, Text, Map, …)
packages/layout    @denotui/layout      Yoga mapping + text measurement
packages/terminal  @denotui/terminal    cells, paint, input, screen
packages/installer @denotui/installer   project installer (`deno x`)
packages/create    @denotui/create      starter template (`deno create`)
```

The workspace root `mod.ts` is the **application barrel**: it re-exports the
runtime, components, layout and terminal packages. The compiler is deliberately
outside it (so app imports never pull Astro/WASM) and is imported directly:
`import { compile } from "@denotui/compiler";`.

## Common commands

```sh
deno task check           # type-check packages, mod.ts, tests
deno task test            # run all tests (reads env NODE_ENV only)
deno task fmt             # format
deno task lint            # lint
deno task build:examples  # compile examples/**/*.tui -> *.tui.ts
deno task example:zoo    # build, then run the AgentZoo example
```

`local/` is excluded from `check` and `test` — the experiment spikes there are
loosely typed on purpose.
