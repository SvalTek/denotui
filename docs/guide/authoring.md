# Authoring `.tui` Components

A component is a `.tui` file with **frontmatter** (executable TypeScript between
`---` fences) and a **template** (HTML-like markup).

```tui
---
import { $agents } from "./stores.ts";
import type { Agent } from "./stores.ts";
import AgentRow from "./AgentRow.tui";

const title = "AgentZoo";
---

<Box direction="column" padding={1}>
  <Text bold>{title}</Text>
  <Text dim>{$agents.length} agents</Text>

  <Map for={$agents}>
    {(agent: Agent) => <AgentRow agent={agent} />}
  </Map>

  <Text>Press q to quit</Text>
</Box>
```

## Frontmatter

- Runs **once per component instance**, not per render. It is the right place
  for setup, constants, stores and effects.
- Top-level `import` statements are hoisted to module scope; everything else
  becomes the instance body.
- Import specifiers ending in `.tui` are rewritten to `.tui.ts`.
- The closing `---` fence is required. An unterminated block is a compile error;
  Astro otherwise treats the whole file as frontmatter.
- Locals are **snapshots**. `const agent = props.agent` keeps the first value
  even though the props object is updated in place. When a value must track
  updates, read it in the render function:

  ```ts
  const agent = () => props.agent as Agent;
  // template: {agent().name}
  ```

- Store mutation methods belong here, not in templates:

  ```ts
  const setFilter = (value: string) => $filter.set(value);
  ```

### Frontmatter-only APIs

`ctx.watch`, `ctx.effect`, `ctx.onCleanup`, `ctx.focus`, `ctx.onKey` are
registered once and must be called while frontmatter runs. `ctx.use` and
`ctx.expr` throw during frontmatter because their snapshot would go stale.

## Template

- Tags with an **uppercase** first letter are components (`Box`, `AgentRow`).
  Lowercase tags are elements; only the built-in host tags used by components
  exist in v1.
- The compiler auto-imports a core vocabulary from the app barrel: `Alert`,
  `Badge`, `Box`, `Button`, `Center`, `Checkbox`, `Column`, `Divider`,
  `HelpBar`, `KeyValue`, `List`, `Map`, `Panel`, `ProgressBar`, `Row`,
  `ScrollView`, `Select`, `Show`, `Spacer`, `Spinner`, `StatusBar`, `Table`,
  `Tabs`, `Text`, `TextInput`, `Toggle`. `Separator` and all other components
  are imported in frontmatter.
- These core names are reserved. Application components may use other names.
- `{...}` in text, an attribute value or as a child is a JavaScript expression.
  Every expression is wrapped in `ctx.expr()` by the compiler.
- Boolean attributes (`bold`, `dim`, `focusable`) become `true`. String
  attributes stay strings. Attribute names that are not identifiers are quoted.
- A single template root is allowed; multiple top-level nodes are wrapped in a
  fragment. `<>...</>` is an explicit fragment.
- Inter-tag whitespace is dropped. Put significant whitespace inside an
  expression.

## Reactive reads

The compiler treats a `$name` identifier in a template expression as a store
read and rewrites it to `ctx.use($name)`:

```tui
<Text>{$agents.length} agents</Text>
```

- Every `$` read subscribes the owning component. Multiple reads subscribe to
  multiple stores.
- A template `$store` is a **value**. Do not write `ctx.use($store)` in a
  template (the inner `$store` is rewritten too) and do not call store methods
  there. For a binding without the `$` prefix, `ctx.use(theStore)` is the escape
  hatch.
- A helper that reads `$store.get()` in frontmatter and is called from the
  template is not reactive. Read the store in the template, or register
  `ctx.watch($store)`.

See [Reactivity](./reactivity.md) for the full model and
[Reference: runtime](../reference/runtime.md) for `Ctx`.

## Typed callbacks

Generated modules are type-checked under `strict`. A template callback has no
contextual parameter type, so annotate arrow parameters:

```tui
<Map for={$agents}>
  {(agent: Agent) => <AgentRow agent={agent} />}
</Map>
```

An unannotated arrow produces a compiler warning; the generated module would
fail `deno check` on the implicit `any`. Annotations are preserved verbatim, as
are defaults and rest parameters.

## Function children

`Map`, `List` and `Select` take a render function as their child:

```tui
<Map for={$agents}>
  {(agent: Agent) => <AgentRow agent={agent} />}
</Map>

<Select
  items={filteredAgents($agents, $filter)}
  selected={$selected}
  onChange={selectAgent}
>
  {(item: Agent, _index: number, selected: boolean) => (
    <AgentRow agent={item} selected={selected} />
  )}
</Select>
```

There is deliberately **no render prop**. JSX inside an attribute expression
(`render={(x) => <Row/>}`) cannot be structured by Astro and is a compile error;
put the function in the element's children. Components decide when to invoke
function children; `Map`/`List`/`Select` call them once per item.

## Conditional rendering

`Show` renders its children only when `when` is truthy; function children are
invoked only when the branch is taken:

```tui
<Show when={$connected}>
  <Text fg="green">connected</Text>
</Show>
```

## What is intentionally not supported (v1)

- Named slots, `set:html`, and Astro directives (`client:*`, `class:list`).
- Raw HTML/`<script>` blocks.
- HTML comments: parsed then dropped (a warning is emitted).
- JSX in attribute expressions.
- Text style inheritance through boxes (backgrounds do inherit).

## Diagnostics

The compiler reports:

- unterminated frontmatter (with the filename);
- untyped arrow parameters in template expressions;
- JSX in attribute expressions;
- dropped HTML comments.

Positions are not reliable (Astro's position data is incomplete), so errors name
the file, not a line. Run `deno check` for TypeScript errors in generated
modules.
