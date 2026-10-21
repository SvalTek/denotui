import { atom } from "nanostores";

export type AgentStatus = "working" | "idle" | "done";

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  progress: number;
}

export const INITIAL_AGENTS: Agent[] = [
  { id: "a1", name: "Atlas", role: "planner", status: "working", progress: 62 },
  { id: "a2", name: "Bolt", role: "coder", status: "idle", progress: 0 },
  {
    id: "a3",
    name: "Cipher",
    role: "reviewer",
    status: "working",
    progress: 27,
  },
  { id: "a4", name: "Delta", role: "tester", status: "done", progress: 100 },
  { id: "a5", name: "Echo", role: "scout", status: "idle", progress: 0 },
];

export const $agents = atom<Agent[]>(INITIAL_AGENTS);
export const $filter = atom("");
export const $selected = atom(0);
export const $log = atom<string[]>([
  "12:00 Atlas started planning",
  "12:01 Bolt waiting for work",
  "12:02 Cipher reviewing the patch",
]);

export function filteredAgents(
  agents: readonly Agent[],
  filter: string,
): readonly Agent[] {
  const query = filter.trim().toLowerCase();
  if (query === "") return agents;
  return agents.filter((agent) =>
    `${agent.name} ${agent.role} ${agent.status}`.toLowerCase().includes(query)
  );
}

/** Demo activity tick: advance working agents and append a log line. */
export function tick(): void {
  let finished = false;
  const next = $agents.get().map((agent) => {
    if (agent.status !== "working") return agent;
    const progress = Math.min(100, agent.progress + 7);
    if (progress >= 100) finished = true;
    return {
      ...agent,
      progress,
      status: progress >= 100 ? "done" : "working",
    } satisfies Agent;
  });
  $agents.set(next);
  const time = new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const message = finished
    ? `${time} an agent finished`
    : `${time} agents are working`;
  $log.set([...$log.get(), message].slice(-50));
}
