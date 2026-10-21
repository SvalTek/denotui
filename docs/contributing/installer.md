# Installer Internals

Public usage is in [Installation](../guide/installation.md). This page records
the design and its verification.

## Behavior

`@denotui/installer` is an **install-only** entry point (`deno x`). It never
builds or creates when a project already exists.

1. Look for `deno.json` then `deno.jsonc` in the current directory.
2. If neither exists: run `deno create jsr:@denotui/create` with inherited stdio
   and exit. The template owns its dependencies and tasks, so the installer does
   not need the created path.
3. If a config exists:
   - `deno add jsr:@denotui/deno-tui jsr:@denotui/compiler`;
   - add the `denotui:build` task;
   - stop.

No `.tui` scan, no build, no post-create edits.

## Config editing

`src/config.ts` parses the file with `jsonc-parser`, then uses
`modify`/`applyEdits` to set only `tasks["denotui:build"]`:

```json
"denotui:build": "deno run -RW @denotui/compiler/cli compile ."
```

- Comments and unrelated tasks are preserved.
- `deno add` preserves JSONC comments as well (verified).
- Re-running writes nothing when the text is unchanged.
- Invalid JSONC is rejected before writing.
- If `deno add` fails, the task is not written and the installer exits nonzero.
  `deno add` may have made its own partial changes before failing; that is
  Deno's behavior.

## Why two dependencies

Generated modules import the app barrel `@denotui/deno-tui` for runtime
primitives and core components. The compiler is only needed by the build task.
Granular `@denotui/runtime`/`@denotui/components` imports remain available for
subset use, but are not installed by default.

## Starter template

`@denotui/create` exposes `./create` for `deno create`. `create.ts` copies
`template/` files, refuses a non-empty target unless `--force`, and prints next
steps. `main.ts` is stored as `main.ts.tpl` so the workspace type-check does not
try to import the not-yet-generated `App.tui.ts`; it is written as `main.ts`.

## Verification

Covered by unit and integration tests; see [Testing](./testing.md).

- Virtual filesystem tests cover both modes, JSONC comments, idempotency,
  malformed configs, and `deno add`/`deno create` failures.
- A real-file run with a fake `deno` on `PATH` verifies the config edits and
  failure path.
- The create script is tested with real directories and a memory IO.
- A generated project built with local `file:` mappings and rendered under a
  PTY.

**Not tested:** the published JSR flows. `deno x jsr:@denotui/installer`,
`deno create jsr:@denotui/create` and `deno add jsr:...` require publishing (or
a staging scope). See [Releasing](./releasing.md).
