/**
 * Structural Nanostores detection.
 *
 * The runtime never imports Nanostores. Any object exposing `get()` and
 * `subscribe(fn)` is treated as a readable store, which covers `atom`, `map`,
 * `computed` and `listen`-less custom stores without coupling the framework to
 * a package version.
 */

export interface StoreLike<T = unknown> {
  get(): T;
  subscribe(fn: (value: T) => void): () => void;
}

export function isStore(value: unknown): value is StoreLike {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { get?: unknown; subscribe?: unknown };
  return typeof candidate.get === "function" &&
    typeof candidate.subscribe === "function";
}
