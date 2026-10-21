# Installer and Starter Template

There is no global CLI requirement for app developers. The installer either
configures the current project or hands off to `deno create` with the starter
template.

## Existing project

Run inside a directory with `deno.json` or `deno.jsonc`:

```sh
deno x -A jsr:@denotui/installer
```

The installer:

1. Adds `@denotui/deno-tui` (the app barrel: runtime, components, layout,
   terminal) and `@denotui/compiler` (the build tool) with `deno add`.
2. Adds the task, preserving existing tasks and JSONC comments:
   ```json
   {
     "tasks": {
       "denotui:build": "deno run -RW @denotui/compiler/cli compile ."
     }
   }
   ```
3. Scans for existing `.tui` files. If any exist, runs `deno task denotui:build`
   once to validate the setup; otherwise it reports that there is nothing to
   build yet.
4. Stops. Re-running is idempotent; a failed `deno add` leaves the config
   untouched, and a failed initial build does not undo the setup.

Build again whenever templates change:

```sh
deno task denotui:build
```

Generated `.tui.ts` modules import the app barrel; the compiler is only needed
by the build task. Import `@denotui/runtime` / `@denotui/components` directly
only when you intentionally want a subset package.

## New project

With no `deno.json[c]` in the current directory, the installer simply runs:

```sh
deno create jsr:@denotui/create
```

and exits. Deno prompts for the project directory; the starter template already
contains its dependency map and tasks, so the installer never needs to know
where the project was created.

You can also start from the template directly:

```sh
deno create jsr:@denotui/create my-app
```

The generated project has:

- `App.tui` — a minimal component.
- `main.ts` — `createApp`, with `q`/Esc to quit.
- `deno.json` — dependencies plus:
  - `denotui:build` — compiles `.tui` files.
  - `start` — builds, then runs the app.
- `.gitignore` — ignores generated `*.tui.ts`.

## Permissions

`-A` is appropriate for the installer: it reads/writes the config and spawns
`deno add` / `deno create`. The generated build task uses `-RW`; the starter
`start` task uses `-A` for the app.

## Before publishing

The JSR specifiers do not resolve until the packages are published
(`@denotui/installer`, `@denotui/create`, the four runtime packages). For local
testing, use `deno run -A packages/installer/main.ts` in a scratch project with
a fake/unpublished-safe dependency step, or test the create script directly:

```sh
deno run -A packages/create/create.ts /tmp/my-app
```
