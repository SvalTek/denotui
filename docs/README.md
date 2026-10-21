# Documentation

This tree is split by audience. The repository root README is the project
overview; start there for a quick sample.

## Guide

Task-oriented pages for people building apps:

1. [Installation](./guide/installation.md) — installer, starter template, manual
   setup, CLI.
2. [Your first app](./guide/first-app.md) — project files, build and run.
3. [Authoring](./guide/authoring.md) — frontmatter, templates, expressions,
   function children.
4. [Components](./guide/components.md) — catalog, composition,
   `Map`/`List`/`Select`, controls.
5. [Reactivity](./guide/reactivity.md) — stores, `$store`, `ctx.use`, effects,
   frontmatter snapshots.
6. [Layout and styling](./guide/layout-and-styling.md) — flexbox props, borders,
   backgrounds, text styles, scroll views.
7. [Input and focus](./guide/input-and-focus.md) — focus order, key routing,
   event cancellation.
8. [Building and deploying](./guide/building.md) — `denotui compile`,
   `deno task`, `deno compile`, diagnostics.
9. [AgentZoo walkthrough](./guide/agent-zoo.md) — the example end to end.

## Reference

Exhaustive API and props pages:

- [Runtime](./reference/runtime.md) — `createApp`, `Root`, `Ctx`, focus,
  lifecycle, node tree.
- [Components](./reference/components.md) — props for every bundled component.
- [Compiler](./reference/compiler.md) — `compile` API, options, core vocabulary,
  CLI.
- [Layout](./reference/layout.md) — Box/Text props, defaults, measurement,
  clipping.
- [Terminal](./reference/terminal.md) — `Screen`, `CellBuffer`, diffing,
  keyboard input.

## Contributing

Internal design and maintenance notes:

- [Architecture](./contributing/architecture.md) — end-to-end model.
- [Compiler internals](./contributing/compiler-internals.md) — parse → IR →
  codegen, frontmatter splitting.
- [Generated code](./contributing/codegen.md) — emitted module contract.
- [Rendering pipeline](./contributing/rendering.md) — layout, cells, diff,
  screen, input.
- [Installer internals](./contributing/installer.md) — installer/template design
  and testing.
- [Oddities](./contributing/oddities.md) — upstream quirks and intentional
  workarounds.
- [Testing](./contributing/testing.md) — commands, permissions, PTY and
  installer harnesses.
- [Releasing](./contributing/releasing.md) — publish prep and staging
  verification.

Design/working documents in `local/` are gitignored and are not part of the
committed documentation.
