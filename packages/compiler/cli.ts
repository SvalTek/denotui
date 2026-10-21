/**
 * `deno-tui build` — compile every `.tui` file under a directory to its
 * generated `.tui.ts` sibling. Intended to run before launching an app and, for
 * `deno compile`, before bundling (generated output is what gets bundled).
 *
 * Usage:
 *   deno run -RWN packages/compiler/cli.ts build [dir] [--check]
 */
import { build } from "./mod.ts";

function usage(): never {
  console.error("usage: deno-tui build [dir] [--check]");
  console.error("");
  console.error("  dir       directory to scan (default: current directory)");
  console.error("  --check   report what would change without writing");
  Deno.exit(2);
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (command !== "build") usage();

  const check = rest.includes("--check");
  const dir = rest.find((arg) => !arg.startsWith("-")) ?? ".";

  const summary = await build({ dir, check });
  const verb = check ? "would write" : "wrote";
  for (const file of summary.written) console.log(`${verb} ${file}`);
  console.log(
    `${summary.written.length} ${verb}, ${summary.unchanged.length} unchanged`,
  );
}

if (import.meta.main) {
  await main(Deno.args);
}
