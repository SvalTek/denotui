/**
 * Installer orchestration.
 *
 * Existing project: add the runtime/components/compiler dependencies, then add
 * the `denotui:build` task. Empty directory: hand off to `deno create` with the
 * starter template and stop; the template already contains its own dependencies
 * and tasks.
 */
import { upsertBuildTask } from "./config.ts";

export const DEPENDENCIES = [
  "jsr:@denotui/deno-tui",
  "jsr:@denotui/compiler",
] as const;

export const CREATE_SPECIFIER = "jsr:@denotui/create";
const CONFIG_FILES = ["deno.json", "deno.jsonc"] as const;

export interface ConfigFs {
  isFile(path: string): Promise<boolean>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, text: string): Promise<void>;
}

export interface CommandOptions {
  cwd: string;
  interactive: boolean;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: CommandOptions,
) => Promise<number>;

export interface InstallOptions {
  cwd: string;
  fs: ConfigFs;
  run: CommandRunner;
  log?: (message: string) => void;
  createSpecifier?: string;
}

export type InstallResult =
  | { mode: "created" }
  | { mode: "configured"; configPath: string; changed: boolean };

function joinPath(directory: string, name: string): string {
  return `${directory.replace(/[\\/]+$/, "")}/${name}`;
}

export async function install(options: InstallOptions): Promise<InstallResult> {
  const log = options.log ?? (() => {});
  const createSpecifier = options.createSpecifier ?? CREATE_SPECIFIER;

  let configName: string | null = null;
  for (const name of CONFIG_FILES) {
    if (await options.fs.isFile(joinPath(options.cwd, name))) {
      configName = name;
      break;
    }
  }

  if (configName === null) {
    log("No deno.json/deno.jsonc found — handing off to deno create.");
    const code = await options.run("deno", ["create", createSpecifier], {
      cwd: options.cwd,
      interactive: true,
    });
    if (code !== 0) {
      throw new Error(`deno create exited with code ${code}`);
    }
    return { mode: "created" };
  }

  const addCode = await options.run(
    "deno",
    ["add", ...DEPENDENCIES],
    { cwd: options.cwd, interactive: true },
  );
  if (addCode !== 0) {
    throw new Error(`deno add exited with code ${addCode}`);
  }

  const configPath = joinPath(options.cwd, configName);
  const before = await options.fs.readTextFile(configPath);
  const { text, changed } = upsertBuildTask(before);
  if (changed) {
    await options.fs.writeTextFile(configPath, text);
    log(`Added task "${"denotui:build"}" to ${configPath}.`);
  } else {
    log(`Task "denotui:build" is already configured.`);
  }

  return { mode: "configured", configPath, changed };
}
