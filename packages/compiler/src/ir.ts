/**
 * Framework-neutral intermediate representation for `.tui` components.
 *
 * The IR sits between the Astro AST and codegen so that:
 *  - the AST→IR lowering has one job (interpret Astro syntax as our node kinds), and
 *  - codegen has one job (turn IR into TypeScript).
 *
 * Keeping them separate means we can snapshot-test both stages independently and
 * swap the emitter (e.g. a future non-TS target) without touching the parser.
 */

/** How a JS expression reached the template, kept for diagnostics/codegen. */
export type ExprContext = "text" | "attribute";

export type NodeIR =
  | TextIR
  | ExprIR
  | ElementIR
  | ComponentIR
  | FragmentIR;

/** A run of literal template text (already whitespace-collapsed by the parser). */
export interface TextIR {
  kind: "text";
  value: string;
}

/** A `{...}` expression. `needsWrap` is true for JSX-bearing expressions that
 *  must stay lazy (see ARCHITECTURE.md §2.2); plain expressions are still routed
 *  through `ctx.expr()` by codegen. */
export interface ExprIR {
  kind: "expr";
  source: string;
  context: ExprContext;
}

/** An intrinsic terminal element, e.g. `<Box>`. `tag` is lowercase (`box`). */
export interface ElementIR {
  kind: "element";
  tag: string;
  attrs: AttrIR[];
  children: NodeIR[];
}

/** A component reference, e.g. `<AgentRow>`. `name` is the frontmatter binding. */
export interface ComponentIR {
  kind: "component";
  name: string;
  attrs: AttrIR[];
  children: NodeIR[];
}

/** A `<>...</>` fragment or the implicit template root. */
export interface FragmentIR {
  kind: "fragment";
  children: NodeIR[];
}

export interface AttrIR {
  name: string;
  /** JS source for the value, `true` for boolean attrs, or `null` when absent. */
  value: string | true;
}

/** Frontmatter split into module-scope imports and instance-scope body. */
export interface FrontmatterIR {
  imports: string[];
  body: string;
}

/** Names the template references, including components written inside JSX that
 *  appears inside `{...}` expressions (which lowering stores as source strings). */
export interface BuiltinUsage {
  /** Every component name referenced by the template, sorted. Includes user
   *  components; codegen filters this down to the auto-imported intrinsics. */
  components: string[];
  usesFragment: boolean;
}

export interface ComponentIRRoot {
  name: string;
  frontmatter: FrontmatterIR;
  /** Template root; always a fragment. */
  root: FragmentIR;
  /** True when the template is a single top-level element/component (no wrapper
   *  fragment emitted). Retained for a future `--no-fragment` optimisation. */
  singleRoot: boolean;
  /** Names referenced by the emitted template, for runtime auto-imports. */
  builtins: BuiltinUsage;
}
