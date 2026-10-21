# @denotui/installer

Configures denotui in an existing Deno project:

```sh
deno x -A jsr:@denotui/installer
```

- Adds `@denotui/deno-tui` and `@denotui/compiler`.
- Adds `denotui:build` to `deno.json`/`deno.jsonc` with comments and unrelated
  tasks preserved.
- Does **not** build anything.

With no `deno.json`/`deno.jsonc` in the current directory it hands off to
`deno create jsr:@denotui/create` and exits.

Docs: [`docs/guide/installation.md`](../../docs/guide/installation.md).
