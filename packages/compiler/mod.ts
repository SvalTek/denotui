/**
 * @denotui/compiler — parses `.tui` sources (Astro syntax) and generates
 * executable TypeScript component modules.
 *
 * Public entry points:
 *   - {@link compile}     — source string -> TypeScript code
 *   - {@link compileFile} — read a `.tui` file and compile it
 *   - {@link build}       — discover and compile a directory tree (used by the CLI)
 */
import { parseToIR } from "./src/parse.ts";
import { generate } from "./src/codegen.ts";
import type { ComponentIRRoot } from "./src/ir.ts";

export type { ComponentIR, ComponentIRRoot, NodeIR } from "./src/ir.ts";
export { parseToIR } from "./src/parse.ts";
export {
  CORE_COMPONENTS,
  generate,
  rewriteTuiSpecifier,
} from "./src/codegen.ts";

export interface CompileOptions {
  /** Component name; defaults to the file basename. */
  name?: string;
  /** Source filename, used for the component name and future error positions. */
  filename?: string;
  /** Import specifier for the runtime in generated code. */
  runtimeSpecifier?: string;
  /** Import specifier for the bundled components in generated code. */
  componentsSpecifier?: string;
}

export interface CompileResult {
  code: string;
  ir: ComponentIRRoot;
  warnings: string[];
}

/** Compile a `.tui` source string into TypeScript module code. */
export async function compile(
  source: string,
  options: CompileOptions = {},
): Promise<CompileResult> {
  const parsed = await parseToIR(source, {
    name: options.name,
    filename: options.filename,
  });
  const code = generate(parsed.ir, {
    runtimeSpecifier: options.runtimeSpecifier,
    componentsSpecifier: options.componentsSpecifier,
  });
  return { code, ir: parsed.ir, warnings: parsed.warnings };
}

/** Read a `.tui` file and compile it. Returns the generated sibling path too. */
export async function compileFile(
  path: string,
  options: CompileOptions = {},
): Promise<CompileResult & { outputPath: string }> {
  const source = await Deno.readTextFile(path);
  const result = await compile(source, { filename: path, ...options });
  return { ...result, outputPath: `${path}.ts` };
}

export interface BuildOptions {
  /** Directory to scan for `*.tui` files. Defaults to cwd. */
  dir?: string;
  /** Only write when the generated output differs from what is on disk. */
  check?: boolean;
}

export interface BuildSummary {
  written: string[];
  unchanged: string[];
}

/** Discover and compile every `*.tui` file under `dir` to a sibling `.tui.ts`. */
export async function build(options: BuildOptions = {}): Promise<BuildSummary> {
  const root = options.dir ?? ".";
  const written: string[] = [];
  const unchanged: string[] = [];

  for await (const entry of walkTui(root)) {
    const result = await compileFile(entry);
    let existing: string | null = null;
    try {
      existing = await Deno.readTextFile(result.outputPath);
    } catch {
      existing = null;
    }
    if (existing === result.code) {
      unchanged.push(result.outputPath);
      continue;
    }
    if (!options.check) {
      await Deno.writeTextFile(result.outputPath, result.code);
      written.push(result.outputPath);
    } else {
      written.push(result.outputPath);
    }
    for (const warning of result.warnings) {
      console.error(`warning: ${entry}: ${warning}`);
    }
  }

  return { written, unchanged };
}

async function* walkTui(dir: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walkTui(path);
    } else if (entry.isFile && entry.name.endsWith(".tui")) {
      yield path;
    }
  }
}
