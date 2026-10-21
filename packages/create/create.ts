/**
 * `deno create jsr:@denotui/create [dir] [--force]`
 *
 * Copies the starter template and prints the next steps. The generated project
 * already contains its dependency map and denotui tasks, so no installer pass is
 * needed afterwards.
 */
import { type CreateIo, createProject, parseCreateArgs } from "./src/create.ts";

const TEMPLATE_FILES: ReadonlyArray<readonly [string, string]> = [
  ["deno.json", "deno.json"],
  ["main.ts.tpl", "main.ts"],
  ["App.tui", "App.tui"],
  ["gitignore", ".gitignore"],
];

const parsed = parseCreateArgs(Deno.args);
let target = parsed.target;
if (target === null) {
  target = prompt("Project directory", "my-denotui-app");
}
if (target === null || target.trim() === "") {
  console.error("error: no project directory provided");
  Deno.exit(1);
}
target = target.trim();

const files: Record<string, string> = {};
for (const [source, destination] of TEMPLATE_FILES) {
  files[destination] = await Deno.readTextFile(
    new URL(`./template/${source}`, import.meta.url),
  );
}

const io: CreateIo = {
  async exists(path) {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  },
  async readDir(path) {
    const entries: string[] = [];
    for await (const entry of Deno.readDir(path)) entries.push(entry.name);
    return entries;
  },
  mkdir(path, options) {
    return Deno.mkdir(path, options);
  },
  writeFile(path, data) {
    return Deno.writeFile(path, data);
  },
};

try {
  await createProject(target, files, io, { force: parsed.force });
  console.log(`Created ${target}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${target}`);
  console.log("  deno task denotui:build");
  console.log("  deno task start");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
  Deno.exit(1);
}
