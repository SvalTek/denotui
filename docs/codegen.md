# Generated Code

For `AgentZoo.tui`, the compiler emits the following `.tui.ts` (formatting shown
multi-line for readability; real output is denser):

```ts
// GENERATED FILE — do not edit. Source of truth is the adjacent .tui file.
import { Box, component, Fragment, h, Map, Text } from "@denotui/deno-tui";
import { $agents } from "./stores.ts";
import type { Agent } from "./stores.ts";
import AgentRow from "./AgentRow.tui.ts";

export default component("AgentZoo", (props, ctx) => {
  const title = "AgentZoo";
  return () =>
    h(Fragment, null, [
      h(Box, { direction: "column", padding: ctx.expr(() => (1)) }, [
        h(Text, { bold: true }, [ctx.expr(() => title)]),
        h(Text, { dim: true }, [
          ctx.expr(() => (ctx.use($agents).length)),
          " agents",
        ]),
        h(Map, { for: ctx.expr(() => (ctx.use($agents))) }, [
          ctx.expr(() => ((agent: Agent) => h(AgentRow, { agent: agent }, []))),
        ]),
        h(Text, null, ["Press q to quit"]),
      ]),
    ]);
});
```

## Rules the emitter follows

1. **Factory returns a render function.** The frontmatter body is the factory
   body (runs once per instance); the template becomes the returned render
   function.
2. **Every template expression is wrapped** in `ctx.expr(() => (expr))`.
3. **Store reads are rewritten.** A `$store` identifier inside a template
   expression becomes `ctx.use($store)`, which subscribes the owning component
   and returns the store's value. See the reactive contract below.
4. **Imports are hoisted** to module scope and `.tui` specifiers are rewritten
   to `.tui.ts`.
5. **Core components are auto-imported.** `component`, `h` and `Fragment` are
   always imported from the app barrel `@denotui/deno-tui` (`Fragment` is the
   template root). The fixed core vocabulary (26 bundled names, listed in
   [`syntax.md`](./syntax.md#template) and exported as `CORE_COMPONENTS`) is
   imported from the same barrel when referenced — including inside JSX that
   appears in an expression, e.g. `{items.map((i) => <Text>{i}</Text>)}`. These
   names are reserved for the framework; any other component (e.g. `Separator`
   or application components) is imported in frontmatter.
6. **String/boolean attribute literals are not wrapped.** Dynamic values are.
   Attribute names that are not valid identifiers (`data-x`) are quoted.
7. **Output is deterministic.** `generate(ir)` is pure, so `build()` can compare
   and skip unchanged files.

## The reactive contract

The compiler cannot know which identifiers are stores, and it cannot inspect the
_value_ of an expression to find one — `$agents.length` evaluates to a number,
so `ctx.expr(() => $agents.length)` would silently return `undefined` while
never subscribing. The contract therefore has two layers:

| Layer             | Emitted when                     | Runtime behavior                                                                             |
| ----------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `ctx.use(value)`  | at each `$store` read            | if store-shaped, subscribe the instance and return `store.get()`; otherwise return the value |
| `ctx.expr(thunk)` | around every template expression | evaluate once, then unwrap a store-shaped **result** via `ctx.use`                           |

`ctx.use` is what makes value reads work; `ctx.expr` keeps the well-defined
behavior for expressions that _produce_ a store (`computed(...)`, or a plain
`$store` read that is itself the whole expression).

Examples:

| Template                         | Generated                                   | Effect                                                                                                       |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `{$title}`                       | `ctx.expr(() => (ctx.use($title)))`         | subscribe; render the value                                                                                  |
| `{$agents.length}`               | `ctx.expr(() => (ctx.use($agents).length))` | subscribe; render the length of the array                                                                    |
| `{$a.length + $b.length}`        | both reads rewritten                        | subscribe to both stores                                                                                     |
| `{title}`                        | `ctx.expr(() => (title))`                   | plain frontmatter value                                                                                      |
| `{computed(() => $a.get() + 1)}` | `ctx.expr(() => (computed(...)))`           | unwrap the store result; define computed stores in frontmatter instead, or a new store is created per render |

The `$` prefix is the Nanostores naming convention, not a type check. A store
whose binding does not start with `$` must be read with `ctx.use(theStore)`
explicitly. Reads that happen _indirectly_ — a frontmatter helper calling
`$store.get()` and the template calling the helper — are invisible to the
compiler and are not reactive; use `ctx.watch($store)` for the side effect or
read the store in the template.

Helper-contract note: wrapping a function child (the `Map` case) means
`ctx.expr` returns the function itself, un-invoked. Its parameters must be typed
in the template `(agent: Agent) => ...`: generated modules are checked by
`deno check`/`deno compile`, and an untyped callback parameter would be an
implicit `any`. The compiler warns at build time when an arrow parameter has no
annotation; types are preserved verbatim. Components decide when to call it.
`$store` reads inside that function are rewritten too, and run when the
component invokes it.

## IR

The intermediate representation is documented inline in
`packages/compiler/src/ir.ts`. Node kinds:
`text | expr | element | component |
fragment`, plus `AttrIR` and
`FrontmatterIR`. `ComponentIRRoot.builtins` records every component name the
template references (including names inside expression JSX); codegen filters it
down to the core vocabulary. Both import specifiers are configurable
(`runtimeSpecifier`, `componentsSpecifier`) for alternate runtimes/design
systems. Keeping IR separate from codegen is what lets us snapshot-test lowering
independently of emission.
