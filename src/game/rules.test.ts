import { describe, expect, it } from "vitest";
import { availableRoute, confirm, newMission, propose, restart, type Action, type MissionState } from "./rules";

const t = 1_000;
function act(state: MissionState, action: Action, at = t) {
  return confirm(propose(state, action, "navigator", at), "engineer", at + 1);
}

describe("lunar relay rules", () => {
  it("only returns safely along crater, beacon, ridge", () => {
    let state = newMission();
    state = act(state, { type: "move", destination: "C" });
    state = act(state, { type: "move", destination: "B" });
    expect(state.repaired).toBe(false);
    expect(availableRoute(state, "C")).toBeNull();
    expect(() => propose(state, { type: "move", destination: "R" }, "navigator", t)).toThrow();
    state = act(state, { type: "repair" });
    state = act(state, { type: "move", destination: "R" });
    state = act(state, { type: "move", destination: "L" });
    expect(state).toMatchObject({ status: "won", position: "L", oxygen: 1, energy: 0 });
  });

  it("loses if the ridge is used on the outbound leg", () => {
    let state = newMission();
    state = act(state, { type: "move", destination: "R" });
    state = act(state, { type: "move", destination: "B" });
    state = act(state, { type: "repair" });
    state = act(state, { type: "move", destination: "R" });
    state = act(state, { type: "move", destination: "L" });
    expect(state).toMatchObject({ status: "lost", energy: -1 });
  });

  it("requires a different player and an unexpired confirmation", () => {
    const pending = propose(newMission(), { type: "move", destination: "C" }, "navigator", t);
    expect(() => confirm(pending, "navigator", t + 1)).toThrow("teammate");
    expect(() => confirm(pending, "engineer", t + 90_000)).toThrow("expired");
    expect(() => propose(pending, { type: "move", destination: "R" }, "engineer", t + 1)).toThrow("pending");
    expect(propose(pending, { type: "move", destination: "R" }, "engineer", t + 90_000).pending?.action).toEqual({
      type: "move",
      destination: "R",
    });
  });

  it("rejects impossible actions and can restart without retaining the old route", () => {
    expect(() => propose(newMission(), { type: "repair" }, "engineer", t)).toThrow();
    expect(() => propose(newMission(), { type: "move", destination: "B" }, "engineer", t)).toThrow();
    const state = act(newMission(), { type: "move", destination: "R" });
    const next = restart(state, "navigator", t);
    expect(next).toMatchObject({ position: "L", oxygen: 6, energy: 5, status: "active" });
    expect(next.events).toHaveLength(1);
  });
});
