import { describe, expect, it } from "vitest";
import { applyProjectAction, newProject } from "./project";

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
});
