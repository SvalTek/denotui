import { atom } from "nanostores";
import { assert, assertEquals } from "@std/assert";
import type { KeyEvent } from "@denotui/terminal";
import { Text } from "@denotui/components";
import { component, createRoot, Fragment, h, type Node } from "../mod.ts";

function key(partial: Partial<KeyEvent>): KeyEvent {
  return {
    name: "",
    sequence: "",
    ctrl: false,
    meta: false,
    shift: false,
    text: null,
    ...partial,
  };
}

function textOf(node: Node): string {
  if (node.kind === "text") return node.value;
  return node.children.map(textOf).join("");
}

function makeField(name: string, log: string[]) {
  return component(name, (_props, ctx) => {
    const focus = ctx.focus();
    ctx.onKey((event) => {
      log.push(`${name}:${event.name}`);
    });
    return () => h(Text, null, [`${name}${focus.isFocused() ? "*" : ""}`]);
  });
}

Deno.test("first focusable mounts focused and Tab traverses in order", () => {
  const log: string[] = [];
  const A = makeField("a", log);
  const B = makeField("b", log);
  const Form = component(
    "Form",
    () => () => h(Fragment, null, [h(A, null, []), h(B, null, [])]),
  );

  const root = createRoot();
  root.mount(Form);
  root.flush();
  assertEquals(textOf(root.document), "a*b");

  root.dispatchKey(key({ name: "tab" }));
  root.flush();
  assertEquals(textOf(root.document), "ab*");

  root.dispatchKey(key({ name: "tab", shift: true }));
  root.flush();
  assertEquals(textOf(root.document), "a*b");
  root.unmount();
});

Deno.test("keys reach only the focused instance", () => {
  const log: string[] = [];
  const A = makeField("a", log);
  const B = makeField("b", log);
  const Form = component(
    "Form",
    () => () => h(Fragment, null, [h(A, null, []), h(B, null, [])]),
  );

  const root = createRoot();
  root.mount(Form);
  root.dispatchKey(key({ name: "x", text: "x" }));
  assertEquals(log, ["a:x"]);

  root.dispatchKey(key({ name: "tab" }));
  root.dispatchKey(key({ name: "y", text: "y" }));
  assertEquals(log, ["a:x", "a:tab", "b:y"]);
  root.unmount();
});

Deno.test("global handlers run for every key and are removed on unmount", () => {
  const log: string[] = [];
  const Global = component("Global", (_props, ctx) => {
    ctx.onKey((event) => log.push(`g:${event.name}`), { global: true });
    return () => h(Text, null, ["global"]);
  });
  const Focused = makeField("f", log);
  const Form = component(
    "Form",
    () => () => h(Fragment, null, [h(Global, null, []), h(Focused, null, [])]),
  );

  const root = createRoot();
  root.mount(Form);
  root.dispatchKey(key({ name: "a", text: "a" }));
  assertEquals(log, ["f:a", "g:a"]);

  root.unmount();
  log.length = 0;
  root.dispatchKey(key({ name: "b", text: "b" }));
  assertEquals(log, []);
});

Deno.test("preventDefault on Tab stops traversal", () => {
  const log: string[] = [];
  const Trap = component("Trap", (_props, ctx) => {
    const focus = ctx.focus();
    ctx.onKey((event) => {
      if (event.name === "tab") event.preventDefault();
    });
    return () => h(Text, null, [focus.isFocused() ? "trap*" : "trap"]);
  });
  const Next = makeField("next", log);
  const Form = component(
    "Form",
    () => () => h(Fragment, null, [h(Trap, null, []), h(Next, null, [])]),
  );

  const root = createRoot();
  root.mount(Form);
  root.dispatchKey(key({ name: "tab" }));
  root.flush();
  assert(textOf(root.document).startsWith("trap*"));
  root.unmount();
});

Deno.test("unmounting the focused instance moves focus to the next", () => {
  const $visible = atom(true);
  const log: string[] = [];
  const A = makeField("a", log);
  const B = makeField("b", log);
  const Form = component("Form", (_props, ctx) => () =>
    h(Fragment, null, [
      ctx.use($visible) ? h(A, null, []) : null,
      h(B, null, []),
    ]));

  const root = createRoot();
  root.mount(Form);
  root.flush();
  assertEquals(textOf(root.document), "a*b");

  $visible.set(false);
  root.flush();
  assertEquals(textOf(root.document), "b*");
  root.unmount();
});

Deno.test("focus handle can move focus programmatically", () => {
  let focusB: () => void = () => {};
  const A = component("A", (_props, ctx) => {
    ctx.focus();
    return () => h(Text, null, ["a"]);
  });
  const B = component("B", (_props, ctx) => {
    const handle = ctx.focus();
    focusB = () => handle.focus();
    return () => h(Text, null, [handle.isFocused() ? "b*" : "b"]);
  });
  const Form = component(
    "Form",
    () => () => h(Fragment, null, [h(A, null, []), h(B, null, [])]),
  );

  const root = createRoot();
  root.mount(Form);
  focusB();
  root.flush();
  assertEquals(textOf(root.document), "ab*");
  root.unmount();
});
