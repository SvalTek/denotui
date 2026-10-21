/**
 * Astro AST → ComponentIR lowering.
 *
 * We consume `@astrojs/compiler`'s `parse()` output (never `transform()`), which
 * means this is the only place that touches Astro's node shapes. The Astro v4
 * node types we handle are `root | frontmatter | component | element | text |
 * expression | attribute` (see docs/guide/authoring.md).
 */
import { parse } from "@astrojs/compiler";
import type { AttrIR, ComponentIRRoot, FrontmatterIR, NodeIR } from "./ir.ts";
import {
  findImportSpans,
  findUntypedArrowParams,
  looksLikeJsx,
} from "./scan.ts";

/** Astro AST node, loosely typed — the compiler's types are not ergonomic. */
interface AstroNode {
  type: string;
  name?: string;
  value?: string;
  attributes?: AstroAttr[];
  children?: AstroNode[];
}

interface AstroAttr {
  type: string;
  kind: "quoted" | "expression" | "empty";
  name: string;
  value: string;
}

export interface ParseResult {
  ir: ComponentIRRoot;
  /** Non-fatal notes surfaced to the CLI/user (e.g. ignored patterns). */
  warnings: string[];
}

export interface ParseOptions {
  /** Component name; defaults to the basename of `filename`. */
  name?: string;
  filename?: string;
}

function baseName(filename: string | undefined): string {
  if (!filename) return "Component";
  const stripped = filename.replace(/\\/g, "/").split("/").pop() ?? "Component";
  return stripped.replace(/\.tui$/, "").replace(/[^A-Za-z0-9_$]/g, "_");
}

/**
 * Astro silently treats an unterminated `---` block as one giant frontmatter
 * node (no diagnostic). That would put the template into the factory body and
 * generate invalid TypeScript, so reject it before parsing.
 */
export function assertFrontmatterClosed(
  source: string,
  filename?: string,
): void {
  const text = source.startsWith("\uFEFF") ? source.slice(1) : source;
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return;
  for (let index = 1; index < lines.length; index++) {
    if (lines[index].trim() === "---") return;
  }
  const location = filename === undefined ? "" : `${filename}: `;
  throw new Error(
    `${location}unterminated frontmatter: missing closing "---" fence`,
  );
}

export async function parseToIR(
  source: string,
  options: ParseOptions = {},
): Promise<ParseResult> {
  assertFrontmatterClosed(source, options.filename);
  const { ast } = await parse(source, { position: false });
  const root = ast as unknown as AstroNode;
  const children = root.children ?? [];
  const warnings: string[] = [];

  const frontmatter: FrontmatterIR = { imports: [], body: "" };
  const template: AstroNode[] = [];
  // The emitted module always wraps the template in a fragment.
  const usage: LoweringUsage = { components: new Set(), usesFragment: true };

  for (const child of children) {
    if (child.type === "frontmatter") {
      const split = splitFrontmatter(child.value ?? "");
      frontmatter.imports.push(...split.imports);
      frontmatter.body = split.body;
      continue;
    }
    if (child.type === "comment") {
      warnings.push("HTML comments are dropped in terminal output");
      continue;
    }
    template.push(child);
  }

  const lowered = lowerChildren(template, warnings, usage);
  const singleRoot = lowered.length === 1 && lowered[0].kind !== "text";

  return {
    ir: {
      name: options.name ?? baseName(options.filename),
      frontmatter,
      root: { kind: "fragment", children: lowered },
      singleRoot,
      builtins: {
        components: [...usage.components].sort(),
        usesFragment: usage.usesFragment,
      },
    },
    warnings,
  };
}

interface LoweringUsage {
  components: Set<string>;
  usesFragment: boolean;
}

/**
 * Split frontmatter source into top-level `import` statements (hoisted to module
 * scope) and the remaining instance body.
 *
 * Detection is scanner-based (see `scan.ts`), so imports are found only in code
 * position: text inside strings, template literals, comments, dynamic
 * `import()`, `import.meta`, and imports nested inside other statements are left
 * in the body. Hoisted spans are blanked out of the body rather than removed,
 * which keeps line numbers stable for future diagnostics.
 */
export function splitFrontmatter(
  raw: string,
): { imports: string[]; body: string } {
  const spans = findImportSpans(raw);
  if (!spans.length) return { imports: [], body: raw.trim() };

  const imports = spans.map((span) => raw.slice(span.start, span.end).trim());
  let body = "";
  let cursor = 0;
  for (const span of spans) {
    body += raw.slice(cursor, span.start);
    body += raw.slice(span.start, span.end).replace(/[^\n]/g, " ");
    cursor = span.end;
  }
  body += raw.slice(cursor);
  return { imports, body: body.trim() };
}

function lowerChildren(
  nodes: AstroNode[],
  warnings: string[],
  usage: LoweringUsage,
): NodeIR[] {
  const out: NodeIR[] = [];
  for (const node of nodes) {
    const lowered = lowerNode(node, warnings, usage);
    if (lowered) out.push(lowered);
  }
  return out;
}

function lowerNode(
  node: AstroNode,
  warnings: string[],
  usage: LoweringUsage,
): NodeIR | null {
  switch (node.type) {
    case "text":
      return { kind: "text", value: node.value ?? "" };
    case "expression": {
      const source = stitchExpression(node, usage);
      warnUntypedArrows(source, warnings);
      return { kind: "expr", source, context: "text" };
    }
    case "element":
      return {
        kind: "element",
        tag: (node.name ?? "div").toLowerCase(),
        attrs: lowerAttrs(node, warnings),
        children: lowerChildren(node.children ?? [], warnings, usage),
      };
    case "component":
      usage.components.add(node.name ?? "Unknown");
      return {
        kind: "component",
        name: node.name ?? "Unknown",
        attrs: lowerAttrs(node, warnings),
        children: lowerChildren(node.children ?? [], warnings, usage),
      };
    case "fragment":
      usage.usesFragment = true;
      return {
        kind: "fragment",
        children: lowerChildren(node.children ?? [], warnings, usage),
      };
    default:
      warnings.push(`ignored unsupported node type "${node.type}"`);
      return null;
  }
}

function lowerAttrs(node: AstroNode, warnings: string[]): AttrIR[] {
  const attrs: AttrIR[] = [];
  for (const attr of node.attributes ?? []) {
    if (attr.kind === "empty") {
      attrs.push({ name: attr.name, value: true });
    } else if (attr.kind === "expression") {
      assertNoAttributeJsx(attr.value);
      warnUntypedArrows(attr.value, warnings);
      attrs.push({ name: attr.name, value: attr.value });
    } else {
      attrs.push({ name: attr.name, value: JSON.stringify(attr.value) });
    }
  }
  return attrs;
}

/**
 * Template expressions are emitted into a type-checked module. There is no
 * contextual type for a callback parameter here, so an unannotated arrow would
 * be an implicit `any`. Typed arrows are the supported form; warn early with the
 * `.tui` source in hand instead of letting `deno check` point at generated code.
 */
function warnUntypedArrows(source: string, warnings: string[]): void {
  for (const name of findUntypedArrowParams(source)) {
    const pattern = name.startsWith("{") || name.startsWith("[");
    const message = pattern
      ? "untyped arrow parameter pattern in a template expression; annotate " +
        "it (e.g. (params: Type) => ...) because generated TypeScript is " +
        "type-checked"
      : `untyped arrow parameter "${name}" in a template expression; annotate ` +
        `it (e.g. (${name}: Type) => ...) because generated TypeScript is ` +
        `type-checked`;
    if (!warnings.includes(message)) warnings.push(message);
  }
}

/**
 * Reconstruct the JS source of an `{...}` expression. Astro leaves JSX inside an
 * expression as *structured* child nodes (`component`/`element`) interleaved with
 * `text` fragments, so we stitch them back into source with `h(...)` calls. Text
 * fragments are preserved verbatim, which is what keeps arrow params like
 * `(agent) =>` intact around the embedded nodes.
 */
function stitchExpression(node: AstroNode, usage: LoweringUsage): string {
  const parts: string[] = [];
  const children = node.children ?? [];
  for (const child of children) {
    if (child.type === "text") {
      parts.push(child.value ?? "");
    } else if (child.type === "component" || child.type === "element") {
      if (child.type === "component") {
        usage.components.add(child.name ?? "Unknown");
      }
      parts.push(
        `h(${nodeRef(child)}, ${emitAttrs(child)}, [${
          emitChildren(child.children ?? [], usage)
        }])`,
      );
    } else if (child.type === "fragment") {
      usage.usesFragment = true;
      parts.push(
        `h(Fragment, null, [${emitChildren(child.children ?? [], usage)}])`,
      );
    } else if (child.type === "expression") {
      parts.push(stitchExpression(child, usage));
    }
  }
  return parts.join("");
}

function nodeRef(node: AstroNode): string {
  const name = node.name ?? "div";
  return node.type === "element" ? JSON.stringify(name.toLowerCase()) : name;
}

function emitAttrs(node: AstroNode): string {
  const parts = (node.attributes ?? []).map((a) => {
    const name = propName(a.name);
    if (a.kind === "empty") return `${name}: true`;
    if (a.kind === "expression") {
      assertNoAttributeJsx(a.value);
      return `${name}: ${a.value}`;
    }
    return `${name}: ${JSON.stringify(a.value)}`;
  });
  return parts.length ? `{ ${parts.join(", ")} }` : "null";
}

function assertNoAttributeJsx(source: string): void {
  if (!looksLikeJsx(source)) return;
  throw new Error(
    "denotui: JSX inside an attribute expression is not supported by the " +
      "parser. Pass a function child instead, e.g. " +
      "<Select items={items}>{(item: Item) => <Row>{item.name}</Row>}</Select>.",
  );
}

function emitChildren(children: AstroNode[], usage: LoweringUsage): string {
  const parts = children.map((c) => {
    if (c.type === "text") return JSON.stringify(c.value ?? "");
    if (c.type === "expression") return stitchExpression(c, usage);
    if (c.type === "component") usage.components.add(c.name ?? "Unknown");
    if (c.type === "fragment") usage.usesFragment = true;
    return `h(${nodeRef(c)}, ${emitAttrs(c)}, [${
      emitChildren(c.children ?? [], usage)
    }])`;
  });
  return parts.join(", ");
}

/** Object-literal-safe property name: `data-x` must be quoted, `bold` need not. */
function propName(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}
