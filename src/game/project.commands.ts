import type { ProjectAction, ProjectState } from "./project";

type IndexedAction =
  | { type: "add"; title: string; acceptance: string }
  | { type: "launch" }
  | { type: "assign"; index: number; owner: number }
  | { type: "focus" | "pause" | "approve"; index: number }
  | { type: "submit"; index: number; evidence: string }
  | { type: "block" | "reject"; index: number; reason: string };

export type ProjectCommand =
  | { type: "pair" | "bind"; code: string }
  | { type: "help" }
  | { type: "status" }
  | { type: "plan" }
  | { type: "question"; question: string }
  | { type: "action"; action: IndexedAction };

export function parseProjectCommand(text: string, botUsername?: string): ProjectCommand | null {
  const input = text.trim();
  const match = /^\/([a-z]+)(?:@([a-z0-9_]+))?(?:\s+([\s\S]+))?$/i.exec(input);
  if (match) {
    if (match[2] && botUsername && match[2].toLowerCase() !== botUsername.toLowerCase())
      return null;
    const command = match[1].toLowerCase();
    const arg = match[3]?.trim() ?? "";
    if (command === "pair" || command === "bind") {
      return /^[A-HJ-NP-Z2-9]{10}$/.test(arg.toUpperCase())
        ? { type: command, code: arg.toUpperCase() }
        : { type: "help" };
    }
    if (command === "help" || command === "status" || command === "plan") return { type: command };
    if (command === "launch") return { type: "action", action: { type: "launch" } };
    if (command === "add") {
      const parts = arg.split("|").map((part) => part.trim());
      return parts.length === 2 && parts.every(Boolean)
        ? { type: "action", action: { type: "add", title: parts[0], acceptance: parts[1] } }
        : { type: "help" };
    }
    if (command === "assign") {
      const assign = /^(\d{1,2})\s+([1-4])$/.exec(arg);
      return assign
        ? {
            type: "action",
            action: { type: "assign", index: Number(assign[1]), owner: Number(assign[2]) },
          }
        : { type: "help" };
    }
    const numbered = /^(\d{1,2})(?:\s+([\s\S]+))?$/.exec(arg);
    if (numbered && Number(numbered[1]) > 0) {
      const index = Number(numbered[1]);
      const detail = numbered[2]?.trim() ?? "";
      if (command === "focus" || command === "pause" || command === "approve") {
        return { type: "action", action: { type: command, index } };
      }
      if (command === "submit" && detail)
        return { type: "action", action: { type: "submit", index, evidence: detail } };
      if ((command === "block" || command === "reject") && detail) {
        return { type: "action", action: { type: command, index, reason: detail } };
      }
    }
    return null;
  }
  if (!botUsername) return null;
  const mentioned = new RegExp(`^@${botUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
  return mentioned.test(input)
    ? { type: "question", question: input.replace(mentioned, "").slice(0, 350) }
    : null;
}

export function resolveProjectAction(state: ProjectState, action: IndexedAction): ProjectAction {
  if (action.type === "add" || action.type === "launch") return action;
  const task = state.tasks[action.index - 1];
  if (!task)
    throw new Error(`Sector ${action.index} does not exist. Use /status to see the task list.`);
  if (action.type === "assign") return { type: "assign", taskId: task.id, owner: action.owner };
  if (action.type === "submit")
    return { type: "submit", taskId: task.id, evidence: action.evidence };
  if (action.type === "block" || action.type === "reject")
    return { type: action.type, taskId: task.id, reason: action.reason };
  return { type: action.type, taskId: task.id };
}

export function projectStatusText(state: ProjectState) {
  const done = state.tasks.filter((task) => task.status === "approved").length;
  const tasks = state.tasks
    .map(
      (task, index) =>
        `${index + 1}. ${task.title} [${task.status}${task.blocker ? ", needs help" : ""}] · crew ${task.owner ?? "?"}`,
    )
    .join("\n");
  return `COMMON MOON / ${state.title}\n${state.goal}\n${done}/${state.tasks.length} sectors revealed · ${state.phase}\n${tasks || "No sectors yet. /add title | done when..."}`;
}

export const PROJECT_HELP =
  "COMMON MOON / PROJECT CREW\n" +
  "/pair CODE — connect this Telegram group\n" +
  "/bind CODE — claim your web crew seat\n" +
  "/plan — ask the agent for a suggested next step (never changes tasks)\n" +
  "/add title | done when... — creator charts a sector\n" +
  "/assign NUMBER CREW_SLOT — creator assigns a teammate\n" +
  "/launch — lock the map once everyone is assigned\n" +
  "/focus NUMBER, /pause NUMBER — log focus time\n" +
  "/submit NUMBER result or link — request a review\n" +
  "/approve NUMBER, /reject NUMBER reason — teammate review\n" +
  "/block NUMBER reason — ask the crew for help\n" +
  "/status — see current sectors. Use the website to explore the Moon.";
