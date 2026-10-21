import AgentZoo from "./AgentZoo.tui.ts";
import { createApp } from "@denotui/runtime";
import { $agents, $filter, $selected, filteredAgents, tick } from "./stores.ts";

type IntervalHandle = Parameters<typeof clearInterval>[0];

let timer: IntervalHandle | null = null;

function stop(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  app.stop();
}

const app = createApp(AgentZoo, {}, {
  onKey(event) {
    if (event.name === "escape" || (event.ctrl && event.name === "c")) {
      stop();
      return;
    }
    // With the filter focused, up/down still drive the roster. Components that
    // handled the key (Select, ScrollView) set defaultPrevented, so skip those.
    if (!event.defaultPrevented) {
      if (event.name === "down") {
        moveSelection(1);
        event.preventDefault();
      } else if (event.name === "up") {
        moveSelection(-1);
        event.preventDefault();
      }
    }
  },
});

function moveSelection(delta: number): void {
  const agents = filteredAgents($agents.get(), $filter.get());
  if (agents.length === 0) return;
  const current = Math.min(Math.max($selected.get(), 0), agents.length - 1);
  $selected.set(Math.min(Math.max(current + delta, 0), agents.length - 1));
}

app.start();
timer = setInterval(tick, 900);

// Smoke/demo aid: `deno run ... --demo-ms=1500` exits cleanly on its own.
const demo = Deno.args.find((arg) => arg.startsWith("--demo-ms="));
if (demo !== undefined) {
  const milliseconds = Number(demo.slice("--demo-ms=".length));
  if (Number.isFinite(milliseconds) && milliseconds > 0) {
    setTimeout(stop, milliseconds);
  }
}
