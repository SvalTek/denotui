import { assertEquals, assertRejects } from "@std/assert";
import {
  type CreateIo,
  createProject,
  parseCreateArgs,
} from "../src/create.ts";

function memoryIo(existing: Record<string, string[]> = {}) {
  const dirs = new Map(Object.entries(existing));
  const writes = new Map<string, string>();
  const io: CreateIo = {
    exists: (path) => Promise.resolve(dirs.has(path) || writes.has(path)),
    readDir: (path) => Promise.resolve(dirs.get(path) ?? []),
    mkdir: (path) => {
      if (!dirs.has(path)) dirs.set(path, []);
      return Promise.resolve();
    },
    writeFile: (path, data) => {
      writes.set(path, new TextDecoder().decode(data));
      return Promise.resolve();
    },
  };
  return { io, writes };
}

Deno.test("create args parse a target and force flag", () => {
  assertEquals(parseCreateArgs([]), { target: null, force: false });
  assertEquals(parseCreateArgs(["app"]), { target: "app", force: false });
  assertEquals(parseCreateArgs(["--force", "app"]), {
    target: "app",
    force: true,
  });
});

Deno.test("createProject writes every template file", async () => {
  const { io, writes } = memoryIo();
  await createProject("app", {
    "deno.json": "{}",
    "main.ts": "console.log(1);",
    ".gitignore": "*.tui.ts\n",
  }, io);

  assertEquals(writes.get("app/deno.json"), "{}");
  assertEquals(writes.get("app/main.ts"), "console.log(1);");
  assertEquals(writes.get("app/.gitignore"), "*.tui.ts\n");
});

Deno.test("createProject refuses a non-empty target without force", async () => {
  const { io } = memoryIo({ app: ["existing.ts"] });
  await assertRejects(
    () => createProject("app", { "deno.json": "{}" }, io),
    Error,
    "not empty",
  );
});

Deno.test("createProject overwrites with force", async () => {
  const { io, writes } = memoryIo({ app: ["existing.ts"] });
  await createProject("app", { "deno.json": "{}" }, io, { force: true });
  assertEquals(writes.get("app/deno.json"), "{}");
});
