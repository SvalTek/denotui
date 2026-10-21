// Durable slice of exp2: the reactive primitives will look like this.
import { atom } from "nanostores";
import { assert, assertEquals } from "@std/assert";

interface StoreLike {
  get(): unknown;
  subscribe(fn: (value: unknown) => void): () => void;
}

export function isStore(v: unknown): v is StoreLike {
  if (typeof v !== "object" || v === null) return false;
  const s = v as { get?: unknown; subscribe?: unknown };
  return typeof s.get === "function" && typeof s.subscribe === "function";
}

Deno.test("isStore detects nanostores atoms, rejects plain objects", () => {
  assert(isStore(atom(0)));
  assert(!isStore({ get: () => 0 }));
  assert(!isStore({ subscribe: () => () => {} }));
  assert(!isStore(null));
  assert(!isStore(42));
});

Deno.test("atom subscribe fires on set and unsubscribe releases", () => {
  const $x = atom(1);
  const seen: number[] = [];
  const unsub = $x.subscribe((v) => seen.push(v));
  assertEquals(seen, [1]);
  $x.set(2);
  assertEquals(seen, [1, 2]);
  unsub();
  $x.set(3);
  assertEquals(seen, [1, 2]);
});

Deno.test("keyed identity survives reorder", () => {
  const before = [{ id: "1" }, { id: "2" }, { id: "3" }];
  const after = [{ id: "3" }, { id: "1" }, { id: "2" }];
  const nodes = new Map(before.map((r) => [r.id, { id: r.id }]));
  const reused = after.map((r) => nodes.get(r.id)!);
  assertEquals(reused.map((n) => n.id), ["3", "1", "2"]);
  assert(nodes.get("1") === reused[1]);
});
