# Reactivity

Reactivity is Nanostores plus a compiler convention: frontmatter runs once, and
template reads subscribe the owning component.

## Stores

Any object with `get()` and `subscribe(fn)` is a store. Nanostores
`atom`/`map`/`computed` work directly; the runtime never imports Nanostores.

```ts
// stores.ts
import { atom } from "nanostores";
export const $count = atom(0);
```

## `$store` in templates

```tui
<Text>{$count}</Text>
<Text>{$agents.length} agents</Text>
<Text>{$a.length + $b.length}</Text>
```

Each `$name` read is rewritten to `ctx.use($name)`: it subscribes the owning
component and returns the current value. Multiple stores in one expression
subscribe independently.

Rules:

- `$store` is a **value** in a template. Do not call `ctx.use($store)` there
  (the inner read is rewritten again) and do not call store methods.
- Mutations belong in frontmatter helpers:
  ```ts
  const increment = () => $count.set($count.get() + 1);
  ```
- A store whose binding does not start with `$` must be read with
  `ctx.use(theStore)` explicitly.
- Reads hidden behind a helper (`const n = () => $count.get()`) are invisible to
  the compiler and do not subscribe. Read the store in the template or use
  `ctx.watch($count)`.

## Derived values

Define computed stores in frontmatter and read them like any other store:

```ts
import { computed } from "nanostores";
const $total = computed([$a, $b], ([a, b]) => a + b);
```

```tui
<Text>{$total}</Text>
```

`ctx.expr` also unwraps a store-shaped result, which matters for expressions
that produce a store rather than a value. Prefer frontmatter definitions so a
new store is not created on every render.

## `watch`, `effect`, `onCleanup`

These are frontmatter-only.

```ts
ctx.watch($filter); // subscribe without reading

ctx.effect(() => {
  const timer = setInterval(flush, 250);
  return () => clearInterval(timer);
});

ctx.onCleanup(() => release());
```

- `watch(store)` subscribes the instance; it is the frontmatter-safe alternative
  to `ctx.use`.
- `effect(fn)` runs after the instance's first commit and after every re-render.
  Its previous cleanup runs first; the returned function is the next cleanup.
  Register once in frontmatter, not inside the render function.
- `onCleanup(fn)` runs once on unmount.

`Spinner`/`ScrollView` use these APIs internally.

## Frontmatter snapshots

Frontmatter runs once. Locals do not update when props change:

```ts
const agent = props.agent; // stale
const agent = () => props.agent; // current when called
```

The props object itself is stable and updated in place, so a getter/function
reads current values during render.

## Scheduling

Store notifications mark the owning instance dirty and schedule one coalesced
microtask frame per root. Multiple `set()` calls in one tick produce one frame.
Dirty instances are processed parents-first; prop changes can dirty children in
a later pass of the same frame. A frame is capped at 100 passes, turning an
effect feedback loop into an error.

`root.flush()` runs pending work synchronously (tests, teardown).

## Subscriptions

Subscriptions are deduplicated per instance per store and released on unmount.
They are not pruned when a conditional branch stops reading a store; an unused
subscription costs one coalesced re-render. This is a tracked tradeoff, not a
correctness issue.

## Reactivity boundaries

- A parent re-render recreates child vnodes and function children; children
  generally re-render. Primitive slot values that compare equal do not.
- Backgrounds inherit through boxes; foreground/attributes do not.
- `createApp` paints once per commit; input events and store updates share the
  same frame path.
