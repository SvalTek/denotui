/**
 * Starter-template scaffolding, factored away from Deno APIs so the directory
 * handling can be tested without touching the real filesystem.
 */
export interface CreateIo {
  exists(path: string): Promise<boolean>;
  readDir(path: string): Promise<string[]>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
}

export interface CreateOptions {
  force?: boolean;
}

export function parseCreateArgs(
  args: readonly string[],
): { target: string | null; force: boolean } {
  const force = args.includes("--force");
  const target = args.find((arg) => !arg.startsWith("-")) ?? null;
  return { target, force };
}

export async function createProject(
  target: string,
  files: Record<string, string>,
  io: CreateIo,
  options: CreateOptions = {},
): Promise<void> {
  if (await io.exists(target)) {
    const entries = await io.readDir(target);
    if (entries.length > 0 && options.force !== true) {
      throw new Error(
        `target directory "${target}" is not empty (use --force to overwrite)`,
      );
    }
  }

  await io.mkdir(target, { recursive: true });
  const encoder = new TextEncoder();
  for (const [relative, content] of Object.entries(files)) {
    const path = `${target.replace(/[\\/]+$/, "")}/${relative}`;
    const slash = path.lastIndexOf("/");
    if (slash > 0) {
      await io.mkdir(path.slice(0, slash), { recursive: true });
    }
    await io.writeFile(path, encoder.encode(content));
  }
}
