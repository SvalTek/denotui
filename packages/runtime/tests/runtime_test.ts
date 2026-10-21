import { atom } from "nanostores";
import { assert, assertEquals, assertThrows } from "@std/assert";
import { component, createRoot, Fragment, h, type Node } from "../mod.ts";
import { Text } from "@denotui/components";

function textOf(node: Node): string {
  if (node.kind === "text") return node.value;
  return node.children.map(textOf).join("");
}

/** Store implementing the structural contract, with subscription counters. */
class TestStore<T> {
  value: T;
  listeners = new Set<(value: T) => void>();

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    return this.value;
  }

  subscribe(listener: (value: T) => void): () => void {
    listener(this.value);
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(value: T): void {
    this.value = value;
    for (const listener of this.listeners) listener(value);
  }
}

Deno.test("frontmatter runs once; render runs per committed update", () => {
  const $count = atom(0);
  let inits = 0;
  let renders = 0;
  const Counter = component("Counter", (_props, ctx) => {
    inits++;
    return () => {
      renders++;
      return h(Text, null, [`count ${ctx.use($count)}`]);
    };
  });

  const root = createRoot();
  root.mount(Counter);
  assertEquals(inits, 1);
  assertEquals(renders, 1);
  assertEquals(textOf(root.document), "count 0");

  $count.set(1);
  root.flush();
  assertEquals(inits, 1);
  assertEquals(renders, 2);
  assertEquals(textOf(root.document), "count 1");
  root.unmount();
});

Deno.test("store updates coalesce into one frame", async () => {
  const $a = atom(1);
  const $b = atom(2);
  let renders = 0;
  const Pair = component("Pair", (_props, ctx) => () => {
    renders++;
    return h(Text, null, [`${ctx.use($a)}:${ctx.use($b)}`]);
  });

  const root = createRoot();
  root.mount(Pair);
  assertEquals(renders, 1);

  $a.set(10);
  $b.set(20);
  assertEquals(renders, 1); // still the same tick

  const tick = Promise.withResolvers<void>();
  setTimeout(tick.resolve, 0);
  await tick.promise;
  assertEquals(renders, 2);
  assertEquals(textOf(root.document), "10:20");
  root.unmount();
});

Deno.test("ctx.expr unwraps a store returned by the thunk", () => {
  const $label = atom("hello");
  let rendered = "";
  const Label = component("Label", (_props, ctx) => () => {
    rendered = ctx.expr(() => $label);
    return h(Text, null, [rendered]);
  });

  const root = createRoot();
  root.mount(Label);
  assertEquals(rendered, "hello");
  $label.set("bye");
  root.flush();
  assertEquals(rendered, "bye");
  root.unmount();
});

Deno.test("ctx.use returns plain values untouched", () => {
  let value: unknown;
  const Plain = component("Plain", (_props, ctx) => () => {
    value = ctx.use(42);
    return h(Text, null, ["plain"]);
  });
  const root = createRoot();
  root.mount(Plain);
  assertEquals(value, 42);
  root.unmount();
});

Deno.test("a store is subscribed once per instance across renders", () => {
  const $x = new TestStore(0);
  const Other = component("Other", (_props, ctx) => () => {
    ctx.use($x);
    ctx.use($x);
    return h(Text, null, ["x"]);
  });

  const root = createRoot();
  root.mount(Other);
  assertEquals($x.listeners.size, 1);
  $x.set(1);
  root.flush();
  assertEquals($x.listeners.size, 1);
  root.unmount();
  assertEquals($x.listeners.size, 0);
});

Deno.test("unmount releases subscriptions and stops re-rendering", () => {
  const $x = atom(0);
  let renders = 0;
  const Watcher = component("Watcher", (_props, ctx) => () => {
    renders++;
    return h(Text, null, [`${ctx.use($x)}`]);
  });

  const root = createRoot();
  root.mount(Watcher);
  root.unmount();
  const before = renders;
  $x.set(1);
  root.flush();
  assertEquals(renders, before);
  assertEquals(textOf(root.document), "");
});

Deno.test("props updates mutate the stable props object and dirty the child", () => {
  const $label = atom("a");
  let childRenders = 0;
  let seen: unknown;
  const Row = component("Row", (props) => {
    seen = props;
    return () => {
      childRenders++;
      return h(Text, null, [String(props.label)]);
    };
  });
  const Parent = component(
    "Parent",
    (_props, ctx) => () => h(Row, { label: ctx.use($label) }, []),
  );

  const root = createRoot();
  root.mount(Parent);
  assertEquals(textOf(root.document), "a");
  assertEquals(childRenders, 1);

  $label.set("b");
  root.flush();
  assertEquals(textOf(root.document), "b");
  assertEquals(childRenders, 2);
  // The render function and frontmatter share one props object.
  assert((seen as Record<string, unknown>).label === "b");
  root.unmount();
});

Deno.test("conditional child unmounts and runs effect cleanup", () => {
  const $show = atom(true);
  let cleanups = 0;
  const Child = component("Child", (_props, ctx) => {
    ctx.effect(() => () => {
      cleanups++;
    });
    return () => h(Text, null, ["child"]);
  });
  const Parent = component(
    "Parent",
    (_props, ctx) => () =>
      h(Fragment, null, [ctx.use($show) ? h(Child, null, []) : null]),
  );

  const root = createRoot();
  root.mount(Parent);
  assertEquals(textOf(root.document), "child");
  assertEquals(cleanups, 0);

  $show.set(false);
  root.flush();
  assertEquals(textOf(root.document), "");
  assertEquals(cleanups, 1);
  root.unmount();
});

Deno.test("effects rerun after every render with cleanup first", () => {
  const $n = atom(0);
  const log: string[] = [];
  const Effectful = component("Effectful", (_props, ctx) => {
    ctx.effect(() => {
      log.push("run");
      return () => log.push("cleanup");
    });
    return () => h(Text, null, [`${ctx.use($n)}`]);
  });

  const root = createRoot();
  root.mount(Effectful);
  assertEquals(log, ["run"]);
  $n.set(1);
  root.flush();
  assertEquals(log, ["run", "cleanup", "run"]);
  root.unmount();
  assertEquals(log, ["run", "cleanup", "run", "cleanup"]);
});

Deno.test("ctx.watch in frontmatter subscribes without reading", () => {
  const $ping = atom(0);
  let renders = 0;
  const Watcher = component("Watcher", (_props, ctx) => {
    ctx.watch($ping);
    return () => {
      renders++;
      return h(Text, null, ["static"]);
    };
  });

  const root = createRoot();
  root.mount(Watcher);
  assertEquals(renders, 1);
  $ping.set(1);
  root.flush();
  assertEquals(renders, 2);
  root.unmount();
});

Deno.test("ctx.use during frontmatter throws with guidance", () => {
  const $x = atom(0);
  const Broken = component("Broken", (_props, ctx) => {
    ctx.use($x);
    return () => h(Text, null, ["never"]);
  });
  const root = createRoot();
  assertThrows(() => root.mount(Broken), Error, "ctx.watch(store)");
});

Deno.test("fragment nodes stay transparent containers", () => {
  const App = component(
    "App",
    () => () => h(Fragment, null, ["a", null, 1, h(Text, null, ["b"])]),
  );
  const root = createRoot();
  root.mount(App);
  assertEquals(textOf(root.document), "a1b");
  root.unmount();
});

Deno.test("onCommit fires on mount and after updates", () => {
  const $n = atom(0);
  const Counter = component(
    "Counter",
    (_props, ctx) => () => h(Text, null, [`${ctx.use($n)}`]),
  );
  const root = createRoot();
  const seen: string[] = [];
  root.onCommit((document) => seen.push(textOf(document)));

  root.mount(Counter);
  assertEquals(seen, ["0"]);

  $n.set(1);
  root.flush();
  assertEquals(seen, ["0", "1"]);

  root.unmount();
  assertEquals(seen, ["0", "1", ""]);
});

Deno.test("duplicate keys do not orphan mounted instances", () => {
  const $n = atom(0);
  let created = 0;
  let cleanups = 0;
  const Child = component("Child", (_props, ctx) => {
    created++;
    ctx.onCleanup(() => {
      cleanups++;
    });
    return () => h(Text, null, ["x"]);
  });
  const Parent = component("Parent", (_props, ctx) => () => {
    ctx.use($n);
    return h(Fragment, null, [
      h(Fragment, { key: "dup" }, [h(Child, null, [])]),
      h(Fragment, { key: "dup" }, [h(Child, null, [])]),
    ]);
  });

  const root = createRoot();
  root.mount(Parent);
  $n.set(1);
  root.flush();
  root.unmount();
  assertEquals(cleanups, created);
});

Deno.test("scheduled frame errors reach root.onError", async () => {
  const $fail = atom(false);
  const Boom = component("Boom", (_props, ctx) => () => {
    ctx.use($fail);
    if ($fail.get()) throw new Error("boom");
    return h(Text, null, ["ok"]);
  });
  const root = createRoot();
  let captured: unknown = null;
  root.onError = (error) => {
    captured = error;
  };
  root.mount(Boom);

  $fail.set(true);
  const tick = Promise.withResolvers<void>();
  setTimeout(tick.resolve, 0);
  await tick.promise;
  assert(captured instanceof Error);
  root.unmount();
});

Deno.test("effect and cleanup registration are frontmatter-only", () => {
  const Bad = component("Bad", (_props, ctx) => () => {
    ctx.effect(() => {});
    return h(Text, null, ["x"]);
  });
  const root = createRoot();
  assertThrows(() => root.mount(Bad), Error, "frontmatter");
});
