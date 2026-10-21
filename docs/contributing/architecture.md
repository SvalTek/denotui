# denotui — Architecture

This document specifies how the framework works end to end: template → compiled
module → component instances → reactive updates → layout → terminal cells.

## 1. Authoring model

A component is a `.tui` file: Astro-style frontmatter + HTML-like template.

```
---
import { $agents } from "./stores.ts";
import type { Agent } from "./stores.ts";
import AgentRow from "./AgentRow.tui";

const title = "AgentZoo";
---

<Box direction="column" padding={1}>
  <Text bold>{title}</Text>
  <Map for={$agents}>
    {(agent: Agent) => <AgentRow agent={agent} />}
  </Map>
  <Text dim>Press q to quit</Text>
</Box>
```

Rules (v1):

- Components used in the template **must be imported in frontmatter** (Astro
  convention — no magic file resolution).
- The compiler rewrites import specifiers ending in `.tui` to `.tui.ts` (the
  generated sibling).
- Bundled components (`Box`, `Text`, `Map`, …) live in `@denotui/components` and
  are ordinary components built on runtime primitives — not compiler intrinsics.
  The compiler auto-imports the fixed 26-name core vocabulary from that package;
  `Separator` and application components are imported in frontmatter. `Map`
  receives `for` and a render-function child like any other component.
- Any `{...}` in the template (text child, attribute value, element child) is a
  JS expression.

## 2. Compilation pipeline

```
.tui source
   │  npm:@astrojs/compiler  parse()        — WASM, returns AST
   ▼
Astro AST  (frontmatter TextNode + element/component/expression nodes)
   │  packages/compiler/src/ir.ts           — lower to framework-neutral IR
   ▼
IR  (see below)
   │  packages/compiler/src/codegen.ts      — emit TypeScript
   ▼
.tui.ts module  (sibling file; gitignored; included for deno compile)
```

### 2.1 IR shape

```ts
type ComponentIR = {
  name: string;
  frontmatter: { imports: string[]; instanceBody: string[] };
  template: NodeIR;
};

type NodeIR =
  | { kind: "text"; value: string }
  | { kind: "expr"; source: string } // wrapped later
  | {
    kind: "element";
    tag: string;
    attrs: AttrIR[];
    children: NodeIR[];
    frag: boolean;
  }
  | { kind: "component"; name: string; attrs: AttrIR[]; children: NodeIR[] };

type AttrIR = {
  name: string;
  value: string /* JS source */ | true; /* boolean attr */
};
```

Frontmatter splitting: top-level `import` statements → module scope (static,
shared); every other statement → instance factory body (runs once per instance).
The split is purely syntactic on top-level statements.

### 2.2 Generated module contract

```ts
// AgentZoo.tui.ts — GENERATED, do not edit
import { Box, component, Fragment, h, Map, Text } from "@denotui/deno-tui";
import AgentRow from "./AgentRow.tui.ts";
import { $agents } from "./stores.ts"; // frontmatter import, hoisted
import type { Agent } from "./stores.ts"; // type-only import, hoisted

export default component("AgentZoo", (props, ctx) => {
  const title = "AgentZoo"; // frontmatter — ONCE per instance
  return () =>
    // render fn — re-run when dirty
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
      ]),
    ]);
});
```

Codegen obligations:

- Every template `{expr}` → `ctx.expr(() => (expr))` (text children, attr
  values, component children expressions). Plain string/boolean attrs pass
  through.
- Every `$store` read inside an expression → `ctx.use($store)`. This is the
  authoring/runtime agreement: `ctx.expr` alone cannot subscribe an expression
  such as `$agents.length`, because it returns a number, not a store.
- Element tags → `h("box", props, children)` (intrinsic string tag); component
  tags → `h(ComponentRef, props, children)`. Fragments → `h(Fragment, …)`.
- Children arrays: strings stay strings; expressions become evaluated values;
  function expressions stay functions (the `Map` contract: the child
  `(agent: Agent) => …` is a value the component invokes).
- `component`, `h` and `Fragment` are always imported from the runtime; core
  components used anywhere in the template — including inside expression JSX —
  are recorded in the IR and imported from the components package.
- Arrow parameters in template expressions keep their type annotations;
  generated modules are type-checked under `strict`, so untyped callbacks are a
  compile warning and borrowed function syntax is preserved verbatim.
- The factory returns the render function; the factory body is the once-per-
  instance frontmatter body.

## 3. Runtime model

### 3.1 Instances

`component(name, factory)` returns a `ComponentType`. Mounting one:

1. Call `factory(props, ctx)` **once** — this is frontmatter execution. `ctx`
   tracks subscriptions/effects scoped to this instance. `props` is a stable
   object: later updates mutate it in place, so render functions see fresh
   values while frontmatter keep its once-only semantics.
2. Call the returned render fn → vnode subtree.
3. Reconcile the subtree into the persistent node tree. Intrinsic elements
   become `element` nodes; text becomes `text` nodes; fragments and component
   boundaries are transparent containers for the renderer. Each component owns
   one subscription set and one dirty bit.
4. Run the instance's effects, then notify `root.onCommit` listeners once the
   frame's dirty set is exhausted.

### 3.2 `ctx` API

```ts
interface Ctx {
  /** Read a value; if store-shaped (get+subscribe), subscribe this instance and
   *  return store.get(). Emitted for every `$store` read in a template. */
  use<T>(value: T): T;
  /** Evaluate a template expression, then unwrap a store-shaped result. */
  expr<T>(evaluate: () => T): T;
  /** Subscribe explicitly (frontmatter-safe). */
  watch(store: StoreLike<unknown>): void;
  /** Run after mount and after each re-render; return cleanup for the next run. */
  effect(fn: () => void | (() => void)): void;
  /** Run once when the instance unmounts. */
  onCleanup(fn: () => void): void;
}
```

Store detection is structural:
`typeof v?.subscribe === "function" && typeof v?.get === "function"` — matches
`atom`/`map`/`computed` from Nanostores without importing them into the
detection path.

`ctx.use`/`ctx.expr` throw while frontmatter is running: it executes once, so a
snapshot would go stale. `ctx.watch` is the frontmatter API. Reads that happen
behind a function call (frontmatter helper using `$store.get()`) are invisible
to the compiler and not reactive.

Subscriptions are deduplicated per instance per store and released on unmount.
They are **not pruned** when a store temporarily stops being rendered; an extra
subscription only costs a (coalesced) re-render. This is a tracked tradeoff (see
[Reactivity](../guide/reactivity.md#subscriptions)): add per-render liveness
tracking when it matters.

### 3.3 Scheduling & frames

```
store.set()  ─► subscriber (ctx.use)  ─► mark instance dirty
                                         └─► scheduleFrame()  (one microtask per root)
frame tick:
  1. snapshot dirty instances; clear bits; sort by depth (parents first)
  2. re-run each render fn → reconcile its subtree (see 3.4)
  3. reconcile may dirty children whose props changed → next pass in same frame
  4. run effects for every re-rendered instance
  5. notify root.onCommit listeners with the committed tree
```

Renderers (layout/paint, M4) subscribe with `root.onCommit`; the runtime itself
does no layout or terminal work. `root.flush()` runs the pending frame
synchronously (tests, teardown). A frame is capped at 100 passes to turn effect
loops into an error instead of a hang.

Input events mark focus state dirty and go through the same frame tick — one
consistent render path, no tearing.

### 3.4 Reconciliation (v1)

- Component nodes: same type → update the stable props object in place; shallow
  compare (children arrays element-wise) decides whether to dirty the instance.
  Different type → unmount + mount (subscriptions and effects cleaned up).
- Element nodes: same tag → replace props and diff children positionally.
- Keyed children: a child with a `key` prop (the `Map` component emits
  `key:`/`id:` keys) is matched by key; unkeyed children are matched
  positionally. Unmatched old nodes unmount. No LIS/move minimization — correct
  order and identity preservation, not minimal DOM-style edits.
- Text nodes: positional; value replaced in place.
- Coarse-grained by design: a parent re-render creates new slot values, so
  function/vnode children usually re-render; primitives that compare equal do
  not.

### 3.5 Slots

Children (possibly including functions) are just values in the vnode children
array. A component decides how/when to invoke function children — that is the
whole `Map` contract. Named slots: deferred past v1.

## 4. Layout (`@denotui/layout`)

- Component and fragment nodes are transparent; each `box`/`text` host gets one
  Yoga node. Style props map to Yoga setters; unknown props are ignored for
  layout purposes. **Box defaults to `direction: "column"`.**
- `Text` is a leaf with a Yoga **measure function** using the shared text
  pipeline: `wrap-ansi` (available width) + `string-width` (cell width) + line
  count. Measurement and painting call the same helpers, so a measured height
  equals the painted line count (the Deno-Ink failure mode).
- Yoga measure modes are honored (`Exactly`/`AtMost`/`Undefined`); width and
  height can be numbers, percent strings or `auto`.
- `calculateLayout(termWidth, termHeight)` produces a positioned tree of
  `{ kind: "box" }` and `{ kind: "text", lines, style }`; text lines are already
  wrapped, so the painter never re-measures.
- `overflow: "hidden"` boxes clip their children; `scrollX`/`scrollY` shift
  children within that clip. `ScrollView` composes this for vertical scrolling.
- Borders set Yoga border widths (content inset) and are painted on the enabled
  edges (single/round/double/heavy/ascii).
- Bare text under a `Box` becomes an implicit unstyled text run. A host element
  inside `Text` is an error. Text style (`fg`/`bg`/attrs/`wrap`) does not
  inherit through boxes in v1.

## 5. Terminal (`@denotui/terminal`)

- **Cell**: `{ char, width: 1|2, style: Style|null, continuation: boolean }`.
  Styles are per cell (fg/bg/attrs), so SGR resets inside text cannot leak
  backgrounds. Wide glyphs use a lead cell + continuation.
- **Buffer**: flat row-major cell array reused across frames. `putText` segments
  graphemes (`Intl.Segmenter`), applies `string-width`, attaches combining
  marks, never splits a wide glyph at a clip edge, and clears both halves when a
  wide glyph is overwritten.
- **Diff**: compare back vs front per row → cursor move per changed run + SGR
  changes + changed chars; unchanged runs are skipped; reset at frame end.
- **Output**: one frame string; `Deno.stdout.writeSync` loop handles partial
  writes. Idle frames emit nothing.
- **Screen**: alternate screen + clear, cursor hide/show, restore. Size from
  `Deno.consoleSize()`, polled (200 ms default) because SIGWINCH is unavailable
  on Windows; listeners fire only on change. Non-TTY fallback 80×24.
- **Input**: Node-compatible stdin raw mode + `readline.emitKeypressEvents`,
  normalized to `KeyEvent { name, sequence, ctrl, meta, shift, text }`. The seam
  lets a future raw decoder add mouse/bracketed paste without app changes.
- **Focus routing**: `root.dispatchKey` runs focused handlers, then global
  handlers, then Tab/Shift-Tab traversal, then returns the event to the app.
  Handlers can prevent default (Tab) or stop propagation. Focus changes dirty
  the instances involved.
- **App loop** (`runtime/src/app.ts`): `root.onCommit` → `layoutTree` →
  `paintLayout` → `diffBuffers` → `Screen.write`; resize forces a full repaint;
  `onKey` gets events and Ctrl-C stops by default. Screen/input are injectable
  for headless tests.

## 5.1 Rendering stack rationale

Yoga + `string-width`/`wrap-ansi` + Node `readline` + an internal cell/diff
implementation. Ink and its ecosystem are explicitly rejected (their layout and
paint behaviour motivated this project); `terminal-kit`/`blessed` bring
conflicting widget/layout models; `ansi-diff` is line-based. See
[Rendering](./rendering.md) for details and known limits.

## 6. Bundled components (`@denotui/components`, re-exported by the app barrel)

| Group        | Components                                                    |
| ------------ | ------------------------------------------------------------- |
| Base         | `Box`, `Text`, `Map`                                          |
| Layout       | `Row`, `Column`, `Center`, `Spacer`, `Divider`, `Panel`       |
| Text         | `Badge`, `Alert`                                              |
| Feedback     | `Spinner`, `ProgressBar`                                      |
| Data         | `List`, `Table`, `KeyValue`                                   |
| Controls     | `Button`, `TextInput`, `Select`, `Checkbox`, `Toggle`, `Tabs` |
| Chrome       | `StatusBar`, `HelpBar`, `Separator`                           |
| Scrolling    | `ScrollView`                                                  |
| Control flow | `Show`                                                        |

Bundled components are ordinary components built on runtime primitives. The
compiler auto-imports the core vocabulary (all of the above except `Separator`)
from the app barrel `@denotui/deno-tui`; applications import anything else in
frontmatter. `Box`/`Text` forward props (minus `children`) to host nodes.
Components always receive a `children` array in `props` (the vnode child list);
`Map`/`List`/`Select` take their render function from it. Anything outside this
catalog is app-level.

## 7. Compiler CLI

```
denotui compile [dir] [--check]
```

- Defaults to cwd; discovers `**/*.tui`, skipping `node_modules` and dot dirs.
- Writes only when output differs (keeps mtimes stable for watch tools).
- `--check` reports changes without writing; compile errors name the file and
  exit nonzero.
- Requires `-RW`.
- `deno compile` story: run the CLI in CI/build, include generated `*.tui.ts`
  via the import graph or `--include`; no runtime transform needed.

## 8. Error handling (v1)

No error boundaries. Render/layout errors propagate; `createApp` restores raw
mode, cursor and the alternate screen through `root.onError` before rethrowing.
Compile errors name the file but not a line; Astro's position data is
incomplete.

## 9. Extension points (post-v1 notes)

- Import hook (`register()`): swap the precompile CLI for transparent
  transforms; same IR/codegen path.
- `deno compile`-friendly static mode: run frontmatter + one render, paint once,
  no subscriptions.
- Named slots, error boundaries, mouse/bracketed paste, OSC-8 hyperlinks.

Focus routing, interactive widgets and scrolling are implemented (M4.5/M4.7).
