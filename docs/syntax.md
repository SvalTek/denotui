# `.tui` Syntax

A component lives in a `.tui` file and has two parts: **frontmatter**
(executable TypeScript between `---` fences) and a **template** (HTML-like
markup).

```
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

- Runs **once per component instance** (not per render). It is the right place
  for setup, constants and local state.
- Top-level `import` statements are hoisted to the generated module scope; every
  other statement becomes the instance body.
- Import specifiers ending in `.tui` are rewritten to `.tui.ts` (the generated
  sibling). See [`compiler.md`](./compiler.md).

## Template

- Tags with an **uppercase** first letter are components (`Box`, `Text`,
  `AgentRow`). Tags with a **lowercase** first letter are elements.
- The compiler auto-imports the bundled core vocabulary from
  `@denotui/components`: `Alert`, `Badge`, `Box`, `Button`, `Center`,
  `Checkbox`, `Column`, `Divider`, `HelpBar`, `KeyValue`, `List`, `Map`,
  `Panel`, `ProgressBar`, `Row`, `ScrollView`, `Select`, `Show`, `Spacer`,
  `Spinner`, `StatusBar`, `Table`, `Tabs`, `Text`, `TextInput`, `Toggle`. These
  names are reserved for the framework; any other component (including
  `Separator` and your own) is imported in frontmatter (Astro convention — no
  file resolution magic).
- `{...}` in text, attribute values, or as an element child is a JavaScript
  expression. Every expression is routed through `ctx.expr()` by the compiler
  (see [`codegen.md`](./codegen.md)).
- Boolean attributes (`bold`, `dim`) become `true`.
- A single template root is allowed; multiple top-level nodes are wrapped in an
  implicit fragment. `<>...</>` is an explicit fragment.

## Reactive values

Frontmatter runs once, so reactivity is expressed in the template. The compiler
treats a `$name` identifier in a template expression as a store read:

```
<Text>{$agents.length} agents</Text>
```

compiles to `ctx.expr(() => (ctx.use($agents).length))`. `ctx.use` subscribes
the owning component and returns the store's current value, so `.length` applies
to the array, not to the store object. Every `$` read in an expression
subscribes — `{$a.length + $b.length}` tracks both stores.

- `$name` is the Nanostores naming convention, not a type check. A store with a
  different binding name must be read explicitly with `ctx.use(theStore)`.
- Property access (`obj.$name`), object keys and object shorthand are not
  rewritten.
- Frontmatter must not call `ctx.use()`/`ctx.expr()`: it runs once, so the value
  would go stale, and the runtime throws a guidance error. Use
  `ctx.watch($store)` there for a side effect.
- A helper that reads `$store.get()` in frontmatter and is called from the
  template is **not** reactive — the compiler cannot see through the call. Read
  the store in the template, or register `ctx.watch($store)`.
- For a store-shaped _result_ (e.g. `{computed(() => ...)}`), `ctx.expr` unwraps
  and subscribes. Prefer defining computed stores in frontmatter and reading
  them as `$total` so the store is not recreated on every render.

See [`codegen.md`](./codegen.md) for the generated-code side of this contract.

## Interaction and focus

Input widgets own focus and key handling; application code does not reimplement
typing:

- The first focusable component gets focus on mount; `Tab`/`Shift-Tab` cycles.
  Unmounting the focused component moves focus to the next one.
- Pass `autoFocus` to request focus explicitly (e.g. the first `TextInput`).
- Focus changes re-render the component, so it can draw a focus ring.
- Components handle their keys: `TextInput` (typing, arrows, backspace, Enter),
  `Select` (arrows/j/k, Enter), `Checkbox`/`Toggle` (Space/Enter), `Button`
  (Enter/Space), `ScrollView` (arrows/PageUp/PageDown/Home/End when
  `focusable`).
- Handlers can call `preventDefault()` (e.g. keep Tab inside a component) and
  `stopPropagation()` (keep the app from seeing a key).
- `createApp({ onKey })` still receives keys that components did not stop.
  Ctrl-C quits unless prevented.
- Custom components call `ctx.focus()` and `ctx.onKey()` in frontmatter.

```ts
const handle = ctx.focus({ autoFocus: true });
ctx.onKey((event) => {
  if (event.name === "return") doThing();
});
```

Returning `focus.isFocused()` during render is reactive: focus changes dirty the
instance.

## Scrolling

`<ScrollView height={10} scroll={offset}>` is an `overflow: hidden` viewport.
Set `scroll` yourself, or pass `focusable` plus `contentHeight` to let arrow and
page keys scroll and clamp. `Box` also accepts `overflow="hidden"` and
`scrollX`/`scrollY` for custom viewports.

## Typed callbacks

Generated `.tui.ts` modules are TypeScript, and Deno type-checks them under
`strict` (`deno check`, `deno compile`). A template callback has no contextual
parameter type, so **annotate arrow parameters in templates**:

```
<Map for={$agents}>
  {(agent: Agent) => <AgentRow agent={agent} />}
</Map>
```

This is why the frontmatter imports `type { Agent }` from the store module.
Typed arrows are preserved verbatim by the compiler. An untyped arrow produces a
compile warning (untyped parameter cannot be inferred); the generated module
would otherwise fail `deno check` on the implicit `any`.

## The `Map` contract (and function children)

`Map` is **not** a compiler instruction. It is an ordinary component that
receives a `for` prop and a render-function child:

```
<Map for={$agents}>
  {(agent: Agent) => <AgentRow agent={agent} />}
</Map>
```

The child expression is preserved as a function value — the compiler
reconstructs the JSX inside it into `h(...)` calls but keeps the surrounding
arrow syntax intact. `Map` decides when to call it, and keys rows by
`item.id`/`item.key` when present (otherwise by index). `$store` reads inside
the function are rewritten to `ctx.use($store)` and run when `Map` invokes it.
Any component may accept function children the same way.

## What is intentionally not supported (v1)

- HTML comments are parsed then dropped (a warning is emitted).
- Head/style-like raw HTML blocks and `<script>` are not interpreted.
- Named slots, `set:html`, and directives (`client:*`, `class:list`) — none of
  Astro's render-time features exist here.
