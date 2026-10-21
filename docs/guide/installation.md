# Installation

There are three ways to set up denotui. The installer is the default for
applications; direct package installation is for people who want to wire the
files themselves.

## Existing Deno project

Run from the project root (a directory containing `deno.json` or `deno.jsonc`):

```sh
deno x -A jsr:@denotui/installer
```

The installer:

1. Runs `deno add` for `@denotui/deno-tui` (the application barrel) and
   `@denotui/compiler` (the build tool).
2. Adds the task:

   ```json
   {
     "tasks": {
       "denotui:build": "deno run -RW @denotui/compiler/cli compile ."
     }
   }
   ```

   Existing tasks and JSONC comments are preserved.
3. Stops. It never builds or scans `.tui` files.

The installer is idempotent; rerunning it leaves everything as-is. If `deno add`
fails, it stops without touching the task configuration.

Build when ready:

```sh
deno task denotui:build
```

### Permissions

`-A` is the practical choice for the installer: it reads and rewrites
`deno.json[c]` and spawns `deno add` / `deno create`. The generated build task
uses `-RW`. The starter app's `start` task uses `-A`.

## Empty directory / new project

If there is no `deno.json` or `deno.jsonc` in the current directory, the
installer simply runs:

```sh
deno create jsr:@denotui/create
```

and exits. Deno prompts for the project directory. The starter template already
contains its dependencies, tasks and a minimal app, so the installer never needs
to know where the project was created.

You can skip the installer and use the template directly:

```sh
deno create jsr:@denotui/create my-app
cd my-app
deno task start
```

The generated project has:

| File         | Purpose                                                          |
| ------------ | ---------------------------------------------------------------- |
| `deno.json`  | App barrel + compiler imports; `denotui:build` and `start` tasks |
| `App.tui`    | Minimal component                                                |
| `main.ts`    | `createApp`, quit on `q`/Esc                                     |
| `.gitignore` | Ignores generated `*.tui.ts`                                     |

## Manual setup

If you do not want the installer:

```sh
deno add jsr:@denotui/deno-tui jsr:@denotui/compiler
```

Add the task to your `deno.json`:

```json
{
  "tasks": {
    "denotui:build": "deno run -RW @denotui/compiler/cli compile ."
  }
}
```

Generated `.tui.ts` modules import `@denotui/deno-tui` for runtime primitives
and core components, so that dependency is required. The compiler is only needed
by the build task. Import `@denotui/runtime` or `@denotui/components` directly
only when you intentionally want a subset package.

## Standalone CLI

For a `denotui` command outside a project:

```sh
# Thin Deno shim
deno install -g -A -n denotui jsr:@denotui/compiler/cli

# Or a standalone binary (no Deno at run time)
deno install -g --compile -A -n denotui jsr:@denotui/compiler/cli
```

Run a JSR export without installing it (the `npx` equivalent):

```sh
deno x -A jsr:@denotui/compiler/cli compile .
```

## Pre-release note

The JSR packages are not published yet. Until they are (or are published to a
staging scope), the `jsr:` commands above cannot resolve. For local development,
see [Testing](../contributing/testing.md) and
[Releasing](../contributing/releasing.md).

## Verify the setup

```sh
deno task denotui:build   # writes .tui.ts siblings
deno task start           # builds, then runs the app
```

If `denotui:build` reports no `.tui` files, that is expected for a fresh
project; add a `.tui` component first.
