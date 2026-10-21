import { assertEquals, assertRejects } from "@std/assert";
import { BUILD_TASK, upsertBuildTask } from "../src/config.ts";
import { type CommandRunner, type ConfigFs, install } from "../src/install.ts";

interface Harness {
  fs: ConfigFs;
  files: Map<string, string>;
  writes: Array<{ path: string; text: string }>;
}

function harness(initial: Record<string, string> = {}): Harness {
  const files = new Map(Object.entries(initial));
  const writes: Array<{ path: string; text: string }> = [];
  return {
    files,
    writes,
    fs: {
      isFile: (path) => Promise.resolve(files.has(path)),
      readTextFile: (path) => {
        const text = files.get(path);
        if (text === undefined) {
          return Promise.reject(new Error(`missing ${path}`));
        }
        return Promise.resolve(text);
      },
      writeTextFile: (path, text) => {
        files.set(path, text);
        writes.push({ path, text });
        return Promise.resolve();
      },
    },
  };
}

function scriptedRunner(code = 0) {
  const calls: Array<{ args: string[]; cwd: string }> = [];
  const run: CommandRunner = (_command, args, options) => {
    calls.push({ args: [...args], cwd: options.cwd });
    return Promise.resolve(code);
  };
  return { run, calls };
}

Deno.test("no config hands off to deno create and writes nothing", async () => {
  const h = harness();
  const runner = scriptedRunner(0);
  const result = await install({ cwd: "/project", fs: h.fs, run: runner.run });

  assertEquals(result, { mode: "created" });
  assertEquals(runner.calls.length, 1);
  assertEquals(runner.calls[0].args, ["create", "jsr:@denotui/create"]);
  assertEquals(h.writes.length, 0);
});

Deno.test("existing project gets dependencies and the build task", async () => {
  const h = harness({
    "/project/deno.json": `{
  // keep this comment
  "tasks": {
    "dev": "deno run -A main.ts"
  }
}`,
  });
  const runner = scriptedRunner(0);
  const result = await install({ cwd: "/project", fs: h.fs, run: runner.run });

  assertEquals(runner.calls[0].args, [
    "add",
    "jsr:@denotui/deno-tui",
    "jsr:@denotui/compiler",
  ]);
  assertEquals(result.mode, "configured");
  const text = h.files.get("/project/deno.json") ?? "";
  assertEquals(text.includes("// keep this comment"), true);
  assertEquals(text.includes('"dev": "deno run -A main.ts"'), true);
  assertEquals(
    text.includes(
      `"${BUILD_TASK}": "deno run -RW @denotui/compiler/cli compile ."`,
    ),
    true,
  );
});

Deno.test("deno.jsonc comments survive the task insertion", async () => {
  const h = harness({
    "/project/deno.jsonc": `{
  // top comment
  "tasks": {
    // existing task
    "dev": "deno run -A main.ts",
  },
}`,
  });
  await install({
    cwd: "/project",
    fs: h.fs,
    run: scriptedRunner(0).run,
  });
  const text = h.files.get("/project/deno.jsonc") ?? "";
  assertEquals(text.includes("// top comment"), true);
  assertEquals(text.includes("// existing task"), true);
  assertEquals(text.includes(`"${BUILD_TASK}"`), true);
});

Deno.test("installation is idempotent", async () => {
  const h = harness({ "/project/deno.json": "{}" });
  await install({ cwd: "/project", fs: h.fs, run: scriptedRunner(0).run });
  const afterFirst = h.files.get("/project/deno.json") ?? "";
  const writesAfterFirst = h.writes.length;

  const second = await install({
    cwd: "/project",
    fs: h.fs,
    run: scriptedRunner(0).run,
  });
  assertEquals(second.mode, "configured");
  if (second.mode === "configured") {
    assertEquals(second.changed, false);
  }
  assertEquals(h.files.get("/project/deno.json"), afterFirst);
  assertEquals(h.writes.length, writesAfterFirst);
});

Deno.test("a failed deno add leaves the config untouched", async () => {
  const original = '{ "tasks": {} }';
  const h = harness({ "/project/deno.json": original });
  await assertRejects(
    () => install({ cwd: "/project", fs: h.fs, run: scriptedRunner(1).run }),
    Error,
    "deno add exited with code 1",
  );
  assertEquals(h.files.get("/project/deno.json"), original);
  assertEquals(h.writes.length, 0);
});

Deno.test("a failed deno create is reported", async () => {
  const h = harness();
  await assertRejects(
    () => install({ cwd: "/project", fs: h.fs, run: scriptedRunner(2).run }),
    Error,
    "deno create exited with code 2",
  );
});

Deno.test("invalid config is rejected before writing", async () => {
  const h = harness({ "/project/deno.json": '{ "tasks": ' });
  await assertRejects(
    () => install({ cwd: "/project", fs: h.fs, run: scriptedRunner(0).run }),
    Error,
    "invalid JSONC",
  );
  assertEquals(h.writes.length, 0);
});

Deno.test("deno.json wins over deno.jsonc", async () => {
  const h = harness({
    "/project/deno.json": "{}",
    "/project/deno.jsonc": "{}",
  });
  const result = await install({
    cwd: "/project",
    fs: h.fs,
    run: scriptedRunner(0).run,
  });
  assertEquals(result.mode, "configured");
  if (result.mode === "configured") {
    assertEquals(result.configPath, "/project/deno.json");
  }
});

Deno.test("upsertBuildTask preserves comments and is idempotent", () => {
  const source = `{
  // surface comment
  "tasks": {
    "a": "b"
  }
}`;
  const once = upsertBuildTask(source);
  assertEquals(once.changed, true);
  assertEquals(once.text.includes("// surface comment"), true);
  assertEquals(once.text.includes('"a": "b"'), true);

  const twice = upsertBuildTask(once.text);
  assertEquals(twice.changed, false);
  assertEquals(twice.text, once.text);
});
