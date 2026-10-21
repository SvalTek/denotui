/**
 * `denotui compile` (alias: `build`) — compile every `.tui` file under a
 * directory to its generated `.tui.ts` sibling. Intended to run before launching
 * an app and, for `deno compile`, before bundling (generated output is what gets
 * bundled).
 *
 * Usage:
 *   deno run -RW packages/compiler/cli.ts compile [dir] [--check]
 */
import { build } from "./mod.ts";

function usage(): never {
  console.error("usage: denotui compile [dir] [--check]");
  console.error("");
  console.error("  dir       directory to scan (default: current directory)");
  console.error("  --check   report what would change without writing");
  console.error("");
  console.error("`build` is accepted as an alias for `compile`.");
  Deno.exit(2);
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (command !== "compile" && command !== "build") usage();

  const check = rest.includes("--check");
  const dir = rest.find((arg) => !arg.startsWith("-")) ?? ".";

  try {
    const summary = await build({ dir, check });
    const verb = check ? "would write" : "wrote";
    for (const file of summary.written) console.log(`${verb} ${file}`);
    console.log(
      `${summary.written.length} ${verb}, ${summary.unchanged.length} unchanged`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`error: ${message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
