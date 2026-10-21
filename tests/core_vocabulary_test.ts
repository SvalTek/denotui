import { assert } from "@std/assert";
import { CORE_COMPONENTS } from "@denotui/compiler";
import * as components from "@denotui/components";

Deno.test("every auto-imported core component exists in @denotui/components", () => {
  const catalog: Record<string, unknown> = { ...components };
  for (const name of CORE_COMPONENTS) {
    assert(Object.hasOwn(catalog, name), `missing export ${name}`);
    const value = catalog[name];
    assert(
      typeof value === "object" && value !== null && "factory" in value,
      `${name} is not a component`,
    );
  }
});
