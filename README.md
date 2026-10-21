# denotui

Astro-style TUI components for Deno: frontmatter + HTML-like templates,
Nanostores reactivity, and a from-scratch terminal renderer (Yoga layout, cell
buffer, frame diff). No React, no browser DOM, no Ink.

```tui
---
import { $agents } from "./stores.ts";
---

<Box direction="column" padding={1} gap={1}>
  <Text bold fg="brightCyan">{ $agents.length } agents</Text>
  <Map for={$agents}>
    {(agent: Agent) => <Text>{agent.name}</Text>}
  </Map>
</Box>
```

## Status

Pre-release. The framework is implemented through the AgentZoo example
(M0–M5.5): compiler, runtime, component catalog, layout, terminal rendering,
focus/input, scrolling, installer and starter template. JSR publication is
pending, so `jsr:@denotui/...` install commands require a published scope or a
staging scope.

## Quick start

In an existing Deno project (`deno.json`/`deno.jsonc`):

```sh
deno x -A jsr:@denotui/installer
deno task denotui:build
```

In an empty directory, the installer hands off to the starter template:

```sh
deno x -A jsr:@denotui/installer
```

Or create a project directly:

```sh
deno create jsr:@denotui/create my-app
cd my-app
deno task start
```

The installer only configures dependencies and the `denotui:build` task. It does
not build or create anything when a project already exists.

## How it works

- `.tui` files compile ahead of time to sibling `.tui.ts` modules.
- Frontmatter runs once per component instance; templates produce reactive
  render functions.
- Store reads written `$store` compile to `ctx.use($store)`, subscribing the
  owning component.
- Layout is Yoga (flexbox) plus a shared wrap/measure pipeline; painting uses a
  cell buffer and emits minimal ANSI diffs.
- Input is decoded through Node's `readline` keypress parser, with focus
  traversal and component-owned key handling.

## Packages

| Package               | Role                                                      |
| --------------------- | --------------------------------------------------------- |
| `@denotui/deno-tui`   | Application barrel: runtime, components, layout, terminal |
| `@denotui/runtime`    | Instances, scheduling, reconciliation, focus, `createApp` |
| `@denotui/components` | Bundled component catalog (`Box`, `Text`, `Map`, …)       |
| `@denotui/layout`     | Yoga mapping, text measurement, positioned paint tree     |
| `@denotui/terminal`   | Cell buffer, diff/SGR, screen, keyboard input             |
| `@denotui/compiler`   | `.tui` → IR → `.tui.ts`, `denotui compile` CLI            |
| `@denotui/installer`  | Configures an existing project (`deno x`)                 |
| `@denotui/create`     | Starter template (`deno create`)                          |

Granular packages exist for intentional subset imports; the app barrel is the
normal import surface. The compiler is deliberately outside it.

## Documentation

Start at [`docs/README.md`](./docs/README.md):

- [Installation](./docs/guide/installation.md)
- [Your first app](./docs/guide/first-app.md)
- [Authoring](./docs/guide/authoring.md)
- [Components](./docs/guide/components.md)
- [Reactivity](./docs/guide/reactivity.md)
- [Layout and styling](./docs/guide/layout-and-styling.md)
- [Input and focus](./docs/guide/input-and-focus.md)
- [Building and deploying](./docs/guide/building.md)
- [AgentZoo walkthrough](./docs/guide/agent-zoo.md)

Reference pages cover the runtime API, component props, compiler API, layout
props and terminal primitives. Contributor internals live under
`docs/contributing/`.

## Requirements

- Deno 2.9 or newer.
- A modern VT terminal (Windows Terminal, iTerm2, Alacritty, kitty, GNOME
  Terminal, …). Legacy Windows conhost is not supported.
- Generated `*.tui.ts` files are build artifacts; ignore them in your project
  and include them for `deno compile`.
