/**
 * `deno x -A jsr:@denotui/installer`
 *
 * Run inside an existing Deno project: adds the denotui dependencies and the
 * `denotui:build` task. With no deno.json[c] in the current directory, hands off
 * to `deno create jsr:@denotui/create` and exits; the starter template carries
 * its own dependencies and tasks.
 */
import { type ConfigFs, install } from "./src/install.ts";

const denoFs: ConfigFs = {
  async isFile(path: string): Promise<boolean> {
    try {
      return (await Deno.stat(path)).isFile;
    } catch {
      return false;
    }
  },
  readTextFile(path: string): Promise<string> {
    return Deno.readTextFile(path);
  },
  writeTextFile(path: string, text: string): Promise<void> {
    return Deno.writeTextFile(path, text);
  },
};

async function run(
  command: string,
  args: readonly string[],
  options: { cwd: string; interactive: boolean },
): Promise<number> {
  const child = new Deno.Command(command, {
    args: [...args],
    cwd: options.cwd,
    stdin: options.interactive ? "inherit" : "null",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  return (await child.status).code;
}

try {
  const result = await install({
    cwd: Deno.cwd(),
    fs: denoFs,
    run,
    log: (message) => console.log(message),
  });

  if (result.mode === "created") {
    console.log("Starter project created. Follow the printed next steps.");
  } else {
    console.log("");
    console.log(
      "denotui dependencies and the denotui:build task are installed.",
    );
    console.log(
      "The installer does not build anything. Compile templates when ready:",
    );
    console.log("  deno task denotui:build");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
  Deno.exit(1);
}
