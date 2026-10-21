# Releasing

> The packages are **not published**. Version `0.1.0` and the `@denotui` scope
> are placeholders.

## Checklist

1. Choose the JSR scope and update every `packages/*/deno.json` `name`.
2. Confirm each package's manifest is self-contained for JSR:
   - `name`, `version`, `exports`;
   - `imports` for external deps (workspace root maps do not travel with a
     package).
3. Declare cross-package dependencies at the versions being published.
4. Add/refresh package READMEs (JSR uses them) and a LICENSE.
5. Run:

   ```sh
   deno task check
   deno task test
   deno task lint
   deno task fmt --check
   deno publish --dry-run
   ```

   Repeat `deno publish --dry-run` in each package if root dry-run does not
   cover workspace members.
6. Publish in dependency order: `layout`, `terminal`, `runtime`, `components`,
   `compiler`, `installer`, `create`, then the root app barrel.
7. Test the **published** flows with a staging scope:
   - `deno add jsr:@scope/deno-tui jsr:@scope/compiler` in a scratch project;
   - `deno x -A jsr:@scope/installer`;
   - `deno create jsr:@scope/create my-app`;
   - `deno task denotui:build` and `deno task start`;
   - resize, focus, controls, log scrolling.
8. Run `deno compile` on the starter and the AgentZoo example.

## Dependency map

| Package                    | Depends on                                                              |
| -------------------------- | ----------------------------------------------------------------------- |
| `@denotui/layout`          | `@denotui/terminal` (types), `yoga-layout`, `string-width`, `wrap-ansi` |
| `@denotui/terminal`        | `string-width` (Node builtins for input)                                |
| `@denotui/runtime`         | `@denotui/layout`, `@denotui/terminal`                                  |
| `@denotui/components`      | `@denotui/runtime`                                                      |
| `@denotui/compiler`        | `@astrojs/compiler`                                                     |
| `@denotui/installer`       | `jsonc-parser`                                                          |
| `@denotui/create`          | none (Deno APIs only)                                                   |
| `@denotui/deno-tui` (root) | runtime, components, layout, terminal                                   |

The compiler is not part of the root app barrel.

## Known publish gaps

- `packages/installer/tests` imports `@std/assert`; either declare it or exclude
  tests from the published package.
- The root package must include `packages/**` files referenced by `mod.ts`, or
  the app barrel must be published differently.
- `@denotui/create` must include `template/` (including `main.ts.tpl`).
- A staging-scope run is the only way to validate `deno x`/`deno create`
  end-to-end; the installer hardcodes `jsr:@denotui/*` specifiers.
