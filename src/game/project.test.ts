import { describe, expect, it } from "vitest";
import { applyProjectAction, newProject, suggestedBuilding, taskBuilding } from "./project";

describe("shared Moon", () => {
  it("requires assignments and a teammate before launch, then another human for approval", () => {
    let state = newProject("Prototype", "Ship an accessible demo");
    state = applyProjectAction(
      state,
      { type: "add", title: "Build UI", acceptance: "Preview link works" },
      1,
      [1],
      1,
    );
    const taskId = state.tasks[0].id;
    expect(() => applyProjectAction(state, { type: "launch" }, 1, [1], 2)).toThrow();
    state = applyProjectAction(state, { type: "assign", taskId, owner: 1 }, 1, [1, 2], 3);
    state = applyProjectAction(state, { type: "launch" }, 1, [1, 2], 4);
    state = applyProjectAction(state, { type: "focus", taskId }, 1, [1, 2], 10);
    state = applyProjectAction(
      state,
      { type: "submit", taskId, evidence: "https://example.org/demo" },
      1,
      [1, 2],
      110,
    );
    expect(state.tasks[0].focusMs).toBe(100);
    expect(() => applyProjectAction(state, { type: "approve", taskId }, 1, [1, 2], 120)).toThrow();
    state = applyProjectAction(state, { type: "approve", taskId }, 2, [1, 2], 130);
    expect(state.tasks[0].status).toBe("approved");
    expect(() =>
      applyProjectAction(state, { type: "add", title: "Late", acceptance: "Done" }, 1, [1, 2], 140),
    ).toThrow();
  });

  it("rejects evidence without review and supports a returned task", () => {
    let state = newProject("Prototype", "Ship");
    state = applyProjectAction(
      state,
      { type: "add", title: "Write docs", acceptance: "README has setup" },
      1,
      [1, 2],
      1,
    );
    const taskId = state.tasks[0].id;
    state = applyProjectAction(state, { type: "assign", taskId, owner: 2 }, 1, [1, 2], 2);
    state = applyProjectAction(state, { type: "launch" }, 1, [1, 2], 3);
    expect(() =>
      applyProjectAction(state, { type: "submit", taskId, evidence: "" }, 2, [1, 2], 4),
    ).toThrow();
    state = applyProjectAction(state, { type: "submit", taskId, evidence: "PR #4" }, 2, [1, 2], 5);
    state = applyProjectAction(
      state,
      { type: "reject", taskId, reason: "Missing deployment" },
      1,
      [1, 2],
      6,
    );
    expect(state.tasks[0]).toMatchObject({
      status: "todo",
      blocker: "Missing deployment",
      evidence: "",
    });
  });

  it("lets the creator choose a building before launch without changing review rules", () => {
    let state = newProject("Prototype", "Ship");
    state = applyProjectAction(
      state,
      { type: "add", title: "Build UI", acceptance: "Preview", buildingKind: "greenhouse" },
      1,
      [1, 2],
      1,
    );
    const taskId = state.tasks[0].id;
    expect(state.tasks[0].buildingKind).toBe("greenhouse");
    expect(() =>
      applyProjectAction(state, { type: "building", taskId, buildingKind: "relay" }, 2, [1, 2], 2),
    ).toThrow("creator");
    state = applyProjectAction(
      state,
      { type: "building", taskId, buildingKind: "workshop" },
      1,
      [1, 2],
      3,
    );
    expect(state.tasks[0].buildingKind).toBe("workshop");
    state = applyProjectAction(state, { type: "assign", taskId, owner: 1 }, 1, [1, 2], 4);
    state = applyProjectAction(state, { type: "launch" }, 1, [1, 2], 5);
    expect(() =>
      applyProjectAction(state, { type: "building", taskId, buildingKind: "relay" }, 1, [1, 2], 6),
    ).toThrow("lock");
    state = applyProjectAction(
      state,
      { type: "submit", taskId, evidence: "Preview ready" },
      1,
      [1, 2],
      7,
    );
    expect(state.tasks[0].status).toBe("submitted");
    expect(() => applyProjectAction(state, { type: "approve", taskId }, 1, [1, 2], 8)).toThrow();
    state = applyProjectAction(state, { type: "approve", taskId }, 2, [1, 2], 9);
    expect(state.tasks[0]).toMatchObject({
      status: "approved",
      buildingKind: "workshop",
      approvedAt: 9,
    });
  });

  it("suggests a visible type for tasks saved before building choices existed", () => {
    expect(suggestedBuilding("Test the demo")).toBe("observatory");
    expect(suggestedBuilding("Connect the agent")).toBe("relay");
    expect(suggestedBuilding("Draw a design")).toBe("greenhouse");
    expect(suggestedBuilding("Build the core")).toBe("workshop");
    expect(taskBuilding({ title: "研究星图" } as Parameters<typeof taskBuilding>[0])).toBe(
      "observatory",
    );
  });
});
