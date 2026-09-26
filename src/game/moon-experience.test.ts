import { describe, expect, it } from "vitest";
import {
  constructionProgress,
  focusElapsed,
  missionComplete,
  voyageChapter,
  voyageDurations,
} from "./moon-experience";
import { applyProjectAction, newProject, type MoonTask } from "./project";

const task: MoonTask = {
  id: "task",
  title: "Build",
  acceptance: "Working demo",
  owner: 1,
  status: "focusing",
  focusStartedAt: 1000,
  focusMs: 0,
  evidence: "",
  blocker: "",
  reviewedBy: null,
};

describe("construction and voyage", () => {
  it("grows during focus, freezes on pause, and cannot reveal a task by waiting", () => {
    expect(constructionProgress(task, 1000)).toBe(0.08);
    expect(constructionProgress(task, 61_000)).toBeGreaterThan(0.08);
    expect(constructionProgress(task, 10_000_000)).toBe(0.92);
    const paused = { ...task, status: "todo" as const, focusStartedAt: null, focusMs: 60_000 };
    expect(constructionProgress(paused, 100_000)).toBe(constructionProgress(paused, 200_000));
    expect(focusElapsed(task, 0)).toBe(0);
    expect(task.status).toBe("focusing");
  });

  it("accelerates only the visual preview, not the focus timer or approval", () => {
    expect(constructionProgress(task, 26_000, 60)).toBeCloseTo(0.92);
    expect(focusElapsed(task, 26_000)).toBe(25_000);
    expect(constructionProgress({ ...task, status: "submitted" }, 26_000)).toBe(0.92);
    expect(constructionProgress({ ...task, status: "approved" }, 26_000)).toBe(1);
  });

  it("only unlocks the return to Earth after every task is reviewed", () => {
    let state = newProject("Shared Moon", "A working demo");
    expect(missionComplete(state)).toBe(false);
    state = { ...state, phase: "launched", tasks: [{ ...task, status: "submitted" }] };
    expect(missionComplete(state)).toBe(false);
    state = applyProjectAction(state, { type: "approve", taskId: task.id }, 2, [1, 2], 10);
    expect(missionComplete(state)).toBe(true);
  });

  it("separates astronomy vignettes from Earth departure and homecoming", () => {
    expect(voyageChapter("outbound", 0)).toBe(0);
    expect(voyageChapter("outbound", 6)).toBe(2);
    expect([0, 3, 6, 9, 12, 15].map((t) => voyageChapter("homebound", t))).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(voyageDurations.homebound).toBeGreaterThan(15);
  });
});
