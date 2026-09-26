import { SITES, type Action, type MissionState, type Site } from "./rules";

export type BotCommand =
  | { type: "pair"; code: string }
  | { type: "bind"; code: string }
  | { type: "propose"; action: Action }
  | { type: "confirm" }
  | { type: "status" }
  | { type: "restart" }
  | { type: "help" }
  | { type: "question"; question: string };

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{10}$/;

export function parseCommand(text: string, botUsername?: string): BotCommand | null {
  const input = text.trim();
  if (!input) return null;
  const matched = /^\/([a-z]+)(?:@([a-z0-9_]+))?(?:\s+(.+))?$/i.exec(input);
  if (matched) {
    if (matched[2] && botUsername && matched[2].toLowerCase() !== botUsername.toLowerCase()) return null;
    const command = matched[1]?.toLowerCase();
    const argument = matched[3]?.trim().toUpperCase() ?? "";
    switch (command) {
      case "pair":
      case "bind":
        return CODE_PATTERN.test(argument) ? { type: command, code: argument } : { type: "help" };
      case "propose":
        if (argument === "REPAIR") return { type: "propose", action: { type: "repair" } };
        return Object.hasOwn(SITES, argument) ? { type: "propose", action: { type: "move", destination: argument as Site } } : { type: "help" };
      case "confirm":
      case "status":
      case "restart":
      case "help":
        return { type: command };
      default:
        return null;
    }
  }
  if (!botUsername) return null;
  const mentioned = new RegExp(`^@${botUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
  return mentioned.test(input) ? { type: "question", question: input.replace(mentioned, "").slice(0, 350) } : null;
}

export function statusText(state: MissionState) {
  const place = SITES[state.position].name;
  const objective = state.repaired ? "Return to LANDER" : state.position === "B" ? "Repair the BEACON" : "Reach the BEACON";
  const pending = state.pending && state.pending.expiresAt > Date.now()
    ? `\nPending: ${state.pending.action.type === "repair" ? "repair" : `move to ${SITES[state.pending.action.destination].name}`}. Teammate: /confirm`
    : "";
  return `LUNAR RELAY / ${state.status.toUpperCase()}\nLocation: ${place}\nOxygen: ${state.oxygen}/6 · Energy: ${state.energy}/5\nObjective: ${objective}${pending}`;
}

export const HELP_TEXT =
  "LUNAR RELAY / MISSION CONTROL\n" +
  "/pair CODE — connect this Telegram group\n" +
  "/bind CODE — claim your crew role\n" +
  "/propose C, R, B, L or REPAIR — suggest an action\n" +
  "/confirm — a different crewmate confirms within 90 seconds\n" +
  "/status — public mission telemetry\n" +
  "/restart — navigator starts a new attempt\n" +
  "Private clues stay on each player's mission screen.";
