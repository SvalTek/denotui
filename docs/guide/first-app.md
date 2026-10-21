# Your First App

This walkthrough uses the starter template and covers the files, commands and
the compile step.

## Create

```sh
deno create jsr:@denotui/create my-app
cd my-app
```

If you are in an empty directory and run `deno x -A jsr:@denotui/installer`, it
hands off to the same `deno create` flow.

## Files

### `App.tui`

```tui
<Box direction="column" padding={1} gap={1}>
  <Text bold fg="brightCyan">Hello denotui</Text>
  <Text dim>Press q to quit</Text>
</Box>
```

`Box` and `Text` are part of the auto-imported core vocabulary. Layout props
follow flexbox; colors accept names, palette indexes or hex.

### `main.ts`

```ts
import App from "./App.tui.ts";
import { createApp } from "@denotui/deno-tui";

const app = createApp(App, {}, {
  onKey(event) {
    if (event.name === "q" || event.name === "escape") app.stop();
  },
});

app.start();
```

`createApp` mounts the component, enters the alternate screen, starts keyboard
input and paints frames. `Ctrl-C` quits by default; `q`/Esc are handled here.

### `deno.json`

```json
{
  "tasks": {
    "denotui:build": "deno run -RW @denotui/compiler/cli compile .",
    "start": "deno task denotui:build && deno run -A main.ts"
  },
  "imports": {
    "@denotui/deno-tui": "jsr:@denotui/deno-tui@^0.1.0",
    "@denotui/compiler": "jsr:@denotui/compiler@^0.1.0"
  }
}
```

`start` builds first because `main.ts` imports `App.tui.ts`, which does not
exist until the compiler runs.

## Run

```sh
deno task start
```

You should see:

```
Hello denotui
Press q to quit
```

Press `q`, `Esc` or `Ctrl-C`. The terminal is restored on exit.

## Build without running

```sh
deno task denotui:build
```

This writes `App.tui.ts` next to `App.tui`. The generated file is a normal
TypeScript module; commit it or ignore it, but include it when using
`deno compile`. The template ignores it with `*.tui.ts`.

## Make it interactive

Add a store and a text input:

```tui
---
import { atom } from "nanostores";

const $name = atom("");
const setName = (value: string) => $name.set(value);
---

<Box direction="column" padding={1} gap={1}>
  <Text bold>Hello {$name || "stranger"}</Text>
  <TextInput
    value={$name}
    placeholder="type your name"
    autoFocus
    onChange={setName}
  />
</Box>
```

`$name` in the template is a store read: the compiler turns it into
`ctx.use($name)`, so the component subscribes and re-renders. `setName` is a
frontmatter helper because template reads are values, not store objects. See
[Reactivity](./reactivity.md) and [Input and focus](./input-and-focus.md).

## Next

- [Authoring](./authoring.md) — syntax and expression rules.
- [Components](./components.md) — the catalog.
- [Layout and styling](./layout-and-styling.md) — flexbox and surfaces.
- [Building and deploying](./building.md) — `deno compile`, diagnostics.
