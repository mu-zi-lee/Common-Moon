import { describe, expect, it } from "vitest";
import { crewPosts } from "./village-model";
import type { MoonTask } from "./project";

const task = (id: string, owner: number, status: MoonTask["status"]): MoonTask => ({
  id,
  title: id,
  acceptance: "Reviewed",
  owner,
  status,
  focusStartedAt: null,
  focusMs: 0,
  evidence: "",
  blocker: "",
  reviewedBy: null,
});

describe("crew on the Moon", () => {
  it("renders one post per real person even when they own multiple sites", () => {
    const tasks = [
      task("first", 1, "approved"),
      task("second", 1, "focusing"),
      task("third", 2, "submitted"),
    ];
    expect(crewPosts(tasks, [1, 2], "first", 100)).toEqual([
      { owner: 1, taskIndex: 1, activity: "working" },
      { owner: 2, taskIndex: 2, activity: "review" },
    ]);
  });

  it("lets a reviewer visit the approved site briefly, then returns to their own work", () => {
    const approved = { ...task("approved", 1, "approved"), reviewedBy: 2, approvedAt: 100 };
    const tasks = [approved, task("next", 2, "todo")];
    expect(crewPosts(tasks, [1, 2, 3], null, 101)).toEqual([
      { owner: 1, taskIndex: 0, activity: "celebrate" },
      { owner: 2, taskIndex: 0, activity: "celebrate" },
      { owner: 3, taskIndex: null, activity: "idle" },
    ]);
    expect(crewPosts(tasks, [1, 2], null, 8_100)[1]).toEqual({
      owner: 2,
      taskIndex: 1,
      activity: "idle",
    });
  });

  it("shows blockers without implying they are approved", () => {
    const blocked = { ...task("blocked", 1, "todo"), blocker: "Waiting for feedback" };
    expect(crewPosts([blocked], [1], null, 10)).toEqual([
      { owner: 1, taskIndex: 0, activity: "blocked" },
    ]);
  });
});
