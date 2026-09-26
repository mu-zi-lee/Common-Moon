import { expect, it } from "vitest";
import { parseProjectCommand, resolveProjectAction } from "./project.commands";
import { applyProjectAction, newProject } from "./project";

it("parses project commands without executing AI suggestions", () => {
  expect(parseProjectCommand("/add Build demo | Teammate opens the link")).toEqual({
    type: "action",
    action: { type: "add", title: "Build demo", acceptance: "Teammate opens the link" },
  });
  expect(parseProjectCommand("/plan")).toEqual({ type: "plan" });
  expect(parseProjectCommand("@MoonBot Help us split this project", "MoonBot")).toEqual({
    type: "question",
    question: "Help us split this project",
  });
  expect(parseProjectCommand("/submit 1 PR #5")).toEqual({
    type: "action",
    action: { type: "submit", index: 1, evidence: "PR #5" },
  });
  let state = newProject("Demo", "Ship");
  state = applyProjectAction(
    state,
    { type: "add", title: "Build", acceptance: "URL works" },
    1,
    [1, 2],
    1,
  );
  expect(resolveProjectAction(state, { type: "approve", index: 1 })).toEqual({
    type: "approve",
    taskId: state.tasks[0].id,
  });
  expect(() => resolveProjectAction(state, { type: "approve", index: 2 })).toThrow();
});
