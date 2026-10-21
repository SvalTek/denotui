# @denotui/compiler

Compiles `.tui` components (Astro-style frontmatter + template) to `.tui.ts`
TypeScript modules for **denotui**.

```sh
denotui compile [dir] [--check]
```

- Uses `@astrojs/compiler` for parsing only.
- Hoists top-level imports, runs the rest of frontmatter once per instance.
- Wraps template expressions in `ctx.expr`; rewrites `$store` reads to
  `ctx.use($store)`.
- Imports runtime primitives and core components from `@denotui/deno-tui` by
  default; both specifiers are configurable.
- Deterministic output; writes only when it changes.

## Programmatic API

```ts
import { compile } from "@denotui/compiler";

const { code, ir, warnings } = await compile(source, {
  filename: "App.tui",
});
```

Also exported: `compileFile`, `build`, `parseToIR`, `generate`,
`rewriteTuiSpecifier`, `CORE_COMPONENTS`.

## Install the CLI

```sh
deno install -g -A -n denotui jsr:@denotui/compiler/cli
```

Project setup via `deno x -A jsr:@denotui/installer` adds a `denotui:build` task
instead.

Docs: [`docs/reference/compiler.md`](../../docs/reference/compiler.md).
