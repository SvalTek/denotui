/**
 * ComponentIR → TypeScript module codegen.
 *
 * Contract produced (see docs/codegen.md):
 *   - frontmatter imports -> module scope
 *   - remaining frontmatter -> component factory body (runs ONCE per instance)
 *   - template -> a render function returned by the factory
 *   - template expressions -> `ctx.expr(() => (...))` so the runtime can detect
 *     Nanostores-shaped values and subscribe the owning component
 *   - `.tui` import specifiers -> `.tui.ts` (generated sibling)
 */
import type { AttrIR, ComponentIRRoot, FragmentIR, NodeIR } from "./ir.ts";
import { rewriteReactive } from "./scan.ts";

/** Runtime symbols always imported from `@denotui/runtime` in generated code.
 *  `Fragment` is always needed because the template root is a fragment. */
const RUNTIME_ALWAYS = ["component", "Fragment", "h"] as const;

/**
 * Language-level core vocabulary: these names are usable in a template without
 * a frontmatter import. This is deliberately a small, fixed list — it is not the
 * component catalog. Every other component (including future `@denotui/components`
 * additions) is imported in frontmatter like application components.
 */
export const CORE_COMPONENTS: readonly string[] = [
  "Alert",
  "Badge",
  "Box",
  "Button",
  "Center",
  "Checkbox",
  "Column",
  "Divider",
  "HelpBar",
  "KeyValue",
  "List",
  "Map",
  "Panel",
  "ProgressBar",
  "Row",
  "ScrollView",
  "Select",
  "Show",
  "Spacer",
  "Spinner",
  "StatusBar",
  "Table",
  "Tabs",
  "Text",
  "TextInput",
  "Toggle",
];

export interface CodegenOptions {
  /** Import specifier for the runtime primitives (default `@denotui/runtime`). */
  runtimeSpecifier?: string;
  /** Import specifier for the bundled components (default `@denotui/components`). */
  componentsSpecifier?: string;
}

export function generate(
  ir: ComponentIRRoot,
  options: CodegenOptions = {},
): string {
  const runtime = options.runtimeSpecifier ?? "@denotui/runtime";
  const components = options.componentsSpecifier ?? "@denotui/components";
  const usedComponents = ir.builtins.components.filter((name) =>
    CORE_COMPONENTS.includes(name)
  );
  const imports = ir.frontmatter.imports.map(rewriteTuiSpecifier);

  const runtimeImport = `import { ${
    [...RUNTIME_ALWAYS].sort().join(", ")
  } } from ${JSON.stringify(runtime)};`;
  const componentsImport = usedComponents.length
    ? `import { ${usedComponents.join(", ")} } from ${
      JSON.stringify(components)
    };`
    : null;

  const template = emitFragment(ir.root);
  const body = ir.frontmatter.body.trim();

  const lines: string[] = [];
  lines.push(
    "// GENERATED FILE — do not edit. Source of truth is the adjacent .tui file.",
  );
  lines.push(
    "// Rebuild with: deno task build:examples  (or the deno-tui build CLI).",
  );
  lines.push(runtimeImport);
  if (componentsImport) lines.push(componentsImport);
  if (imports.length) lines.push(...imports);
  lines.push("");
  lines.push(
    `export default component(${JSON.stringify(ir.name)}, (props, ctx) => {`,
  );
  if (body) lines.push(indent(body, 1));
  lines.push(`  return () => ${template};`);
  lines.push("});");
  lines.push("");
  return lines.join("\n");
}

/**
 * Template text is collapsed to a single line where possible: adjacent literal
 * text and expressions are joined, and purely-whitespace text between blocks is
 * dropped (terminal layout does not rely on inter-tag whitespace).
 */
function emitChildren(children: NodeIR[]): string {
  const parts: string[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer.trim() !== "") parts.push(JSON.stringify(buffer));
    buffer = "";
  };
  for (const child of children) {
    switch (child.kind) {
      case "text":
        buffer += child.value;
        break;
      case "expr":
        flush();
        parts.push(emitExpr(child.source));
        break;
      case "element":
      case "component":
        flush();
        parts.push(emitVNode(child));
        break;
      case "fragment":
        flush();
        parts.push(emitFragment(child));
        break;
    }
  }
  flush();
  return parts.join(", ");
}

function emitVNode(node: NodeIR & { kind: "element" | "component" }): string {
  const type = node.kind === "element" ? JSON.stringify(node.tag) : node.name;
  const props = emitProps(node.attrs);
  const children = emitChildren(node.children);
  return `h(${type}, ${props}, [${children}])`;
}

function emitFragment(node: FragmentIR): string {
  return `h(Fragment, null, [${emitChildren(node.children)}])`;
}

function emitProps(attrs: AttrIR[]): string {
  if (!attrs.length) return "null";
  const parts = attrs.map((a) => {
    const name = propName(a.name);
    if (a.value === true) return `${name}: true`;
    return `${name}: ${wrapAttrExpr(a.value)}`;
  });
  return `{ ${parts.join(", ")} }`;
}

/** Attribute string literals pass through; dynamic values are lazily wrapped. */
function wrapAttrExpr(value: string): string {
  if (value.startsWith('"') || value.startsWith("'")) return value;
  return `ctx.expr(() => (${rewriteReactive(value)}))`;
}

/** Template text/JSX expressions route through ctx.expr for store detection. */
function emitExpr(source: string): string {
  return `ctx.expr(() => (${rewriteReactive(source)}))`;
}

/** Object-literal-safe property name: `data-x` must be quoted, `bold` need not. */
function propName(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/** Rewrite `.tui` import specifiers to their generated `.tui.ts` siblings. */
export function rewriteTuiSpecifier(statement: string): string {
  return statement.replace(
    /(['"])([^'"]+?)\.tui\1/g,
    (_match, quote: string, path: string) => `${quote}${path}.tui.ts${quote}`,
  );
}

function indent(text: string, levels: number): string {
  const pad = "  ".repeat(levels);
  return text.split("\n").map((line) => (line ? pad + line : line)).join("\n");
}
