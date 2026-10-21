# Testing

## Commands

```sh
deno task check      # type-check packages, examples, tests
deno task test       # all tests (read + env for NODE_ENV)
deno task lint
deno task fmt
deno task build:examples
deno task example:zoo
```

Tests use `-RE=NODE_ENV` because importing Nanostores reads `NODE_ENV`. Write
permission is intentionally not granted to the suite; filesystem-dependent code
is tested through injected IO. `local/` is excluded from check/test.

## Layout

| Path                        | Coverage                                                            |
| --------------------------- | ------------------------------------------------------------------- |
| `packages/compiler/tests`   | scanner, frontmatter split, IR/codegen, frontmatter/JSX diagnostics |
| `packages/runtime/tests`    | instances, scheduling, reconciliation, focus, app loop              |
| `packages/components/tests` | catalog behavior, controlled inputs, scrolling, wide text           |
| `packages/layout/tests`     | geometry, measurement, borders, clipping, background inheritance    |
| `packages/terminal/tests`   | cells, diff/SGR, screen lifecycle, key normalization                |
| `packages/installer/tests`  | virtual-FS installer modes and config editing                       |
| `packages/create/tests`     | argument parsing and template copying                               |
| `tests/`                    | workspace resolution and core-vocabulary drift                      |

## Installer before publication

The installer spawns `deno add`/`deno create`, which need published packages.
Two harnesses avoid that:

1. **Virtual FS + scripted runner** in unit tests (no subprocesses).
2. **Real files + fake `deno` on PATH**. A small executable named `deno` logs
   its arguments and exits with a configurable code; run the installer with the
   real Deno binary by absolute path while `PATH` points at the fake:

   ```sh
   PATH="/path/to/fakebin:$PATH" /path/to/deno run -A packages/installer/main.ts
   ```

   This exercises real config edits, JSONC preservation, idempotency and failure
   handling.

The create script can be exercised directly:

```sh
deno run -A packages/create/create.ts /tmp/my-app
```

Local starter verification (before JSR publish): replace the template's JSR
imports with `file:` URLs to the repository (`mod.ts`, compiler `mod.ts`), run
`deno task denotui:build`, then mount `App.tui.ts` or run a short smoke script
under a PTY.

## Live terminal checks

PTY smoke (Linux/WSL) for alt-screen lifecycle and rendering:

```sh
script -q -c "deno run -RE=NODE_ENV examples/agent-zoo/main.ts --demo-ms=1500" /tmp/zoo.log
grep -c $'\033\[?1049h' /tmp/zoo.log
grep -c $'\033\[?1049l' /tmp/zoo.log
```

`--demo-ms` is an example-app aid for unattended runs; production apps quit on
keys. Compile and run the binary:

```sh
deno compile --allow-read --allow-env=NODE_ENV --output local/agent-zoo.exe examples/agent-zoo/main.ts
```

Unit tests cannot prove terminal behavior; manual checks cover native Windows
Terminal (colors, resize, raw mode) and wide characters.

## Known gaps

- Published JSR install/create flows are untested until publication.
- Native Windows Terminal behavior is manual (the PTY harness runs under WSL).
- Node `readline` key decoding is tested with synthetic streams and PTY input,
  not every platform's edge keys.
