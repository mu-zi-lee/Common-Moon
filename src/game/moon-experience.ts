import type { MoonTask, ProjectState } from "./project";

export type Voyage = "outbound" | "homebound";
export const voyageDurations: Record<Voyage, number> = { outbound: 9, homebound: 17 };

export function focusElapsed(task: MoonTask, now: number) {
  return (
    Math.max(0, task.focusMs) +
    (task.status === "focusing" && task.focusStartedAt !== null
      ? Math.max(0, now - task.focusStartedAt)
      : 0)
  );
}

// Construction is visual effort, never an authoritative completion signal.
export function constructionProgress(task: MoonTask, now: number, rate = 1) {
  if (task.status === "approved") return 1;
  if (task.status === "submitted") return 0.92;
  const elapsed = focusElapsed(task, now);
  if (elapsed === 0 && task.status !== "focusing") return 0;
  return Math.min(0.92, 0.08 + ((elapsed * Math.max(1, rate)) / (25 * 60_000)) * 0.84);
}

export function missionComplete(state: ProjectState) {
  return (
    state.phase === "launched" &&
    state.tasks.length > 0 &&
    state.tasks.every((task) => task.status === "approved")
  );
}

export function voyageChapter(voyage: Voyage, elapsed: number) {
  const boundaries = voyage === "outbound" ? [2.5, 5.5] : [3, 6, 9, 12, 15];
  return boundaries.filter((boundary) => elapsed >= boundary).length;
}

export const voyageCopy = {
  outbound: [
    ["DEPARTURE / EARTH", "A small beginning.", "Together, we lift off."],
    ["TRANSFER / EARTH TO MOON", "One shared destination.", "Different places. The same Moon."],
    ["ARRIVAL / YOUR MOON", "A world to make.", "千里共婵娟"],
  ],
  homebound: [
    ["DEPARTURE / MOON", "Look what we made.", "Every piece, made together."],
    [
      "SKY JOURNAL / LUNAR PHASES",
      "A changing face.",
      "The sunlit half looks different as our viewpoint changes.",
    ],
    [
      "SKY JOURNAL / EARTHSHINE",
      "Light from home.",
      "Earth reflects sunlight onto the Moon's night side.",
    ],
    [
      "SKY JOURNAL / LUNAR ECLIPSE",
      "A copper Moon.",
      "Earth's shadow dims the Moon. Filtered sunlight lends it a red glow.",
    ],
    ["APPROACH / EARTH", "Home, together.", "Your shared Moon stays behind. Your work comes home."],
    ["ARRIVAL / EARTH", "Welcome home.", "A journey completed. A world made together."],
  ],
} as const;
