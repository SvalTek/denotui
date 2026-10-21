/**
 * deno-tui — Astro-style TUI component framework for Deno.
 *
 * Application entry point: re-exports the runtime, components, layout and
 * terminal packages so app code and generated `.tui.ts` modules can use one
 * specifier. The compiler is a build tool and remains in `@denotui/compiler`
 * so importing the app barrel never pulls the Astro/WASM compiler.
 */

export * from "./packages/components/mod.ts";
export * from "./packages/runtime/mod.ts";
export * from "./packages/layout/mod.ts";
export * from "./packages/terminal/mod.ts";
