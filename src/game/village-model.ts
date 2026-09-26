import type { MoonTask } from "./project";

export const crewColors = ["#d48365", "#7cacb6", "#9ab786", "#d8b775"];

export type CrewPost = {
  owner: number;
  taskIndex: number | null;
  activity: "working" | "review" | "blocked" | "celebrate" | "idle";
};

export function crewPosts(
  tasks: MoonTask[],
  slots: number[],
  selectedId: string | null,
  now: number,
): CrewPost[] {
  return slots.map((owner) => {
    const focusing = tasks.findIndex((task) => task.owner === owner && task.status === "focusing");
    if (focusing !== -1) return { owner, taskIndex: focusing, activity: "working" };

    const celebration = tasks.findIndex(
      (task) =>
        task.status === "approved" &&
        (task.owner === owner || task.reviewedBy === owner) &&
        task.approvedAt != null &&
        now >= task.approvedAt &&
        now - task.approvedAt < 8_000,
    );
    if (celebration !== -1) return { owner, taskIndex: celebration, activity: "celebrate" };

    const owned = tasks
      .map((task, taskIndex) => ({ task, taskIndex }))
      .filter(({ task }) => task.owner === owner);
    const target =
      owned.find(({ task }) => task.id === selectedId) ??
      owned.find(({ task }) => task.status === "submitted") ??
      owned.find(({ task }) => !!task.blocker) ??
      owned.find(({ task }) => task.status === "todo") ??
      owned[0];
    if (!target) return { owner, taskIndex: null, activity: "idle" };
    return {
      owner,
      taskIndex: target.taskIndex,
      activity:
        target.task.status === "submitted" ? "review" : target.task.blocker ? "blocked" : "idle",
    };
  });
}
