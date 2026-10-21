# @denotui/runtime

Component instances, vnode model, coalesced scheduling, reconciliation, focus
routing and the `createApp` render loop for **denotui**.

```ts
import { component, createApp, h } from "@denotui/runtime";

const App = component("App", (_props, ctx) => {
  const $count = atom(0);
  return () => h("text", null, [String(ctx.use($count))]);
});

const app = createApp(App);
app.start();
```

- Frontmatter (`factory`) runs once; render functions re-run when dirty.
- `ctx.use`/`expr`/`watch`/`effect`/`onCleanup` for reactivity and lifecycle.
- `ctx.focus`/`onKey` for focus-aware components.
- `Root.onCommit` exposes the committed node tree to renderers.
- Terminal restoration on fatal frame errors via `Root.onError`.

The application barrel `@denotui/deno-tui` re-exports this package together with
components, layout and terminal. Use this package directly for subset imports.

Docs: [`docs/reference/runtime.md`](../../docs/reference/runtime.md).
