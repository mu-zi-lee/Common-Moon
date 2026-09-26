export type Site = "L" | "R" | "C" | "B";
export type Role = "navigator" | "engineer";
export type MissionStatus = "active" | "won" | "lost";
export type Action = { type: "move"; destination: Site } | { type: "repair" };

export type PendingAction = {
  action: Action;
  proposedBy: string;
  expiresAt: number;
};

export type MissionEvent = {
  id: number;
  at: number;
  actor: string;
  kind: "move" | "repair" | "lost" | "won" | "restart";
  text: string;
  from?: Site;
  to?: Site;
};

export type MissionState = {
  position: Site;
  oxygen: number;
  energy: number;
  repaired: boolean;
  status: MissionStatus;
  pending: PendingAction | null;
  events: MissionEvent[];
  revision: number;
  seenMessages?: string[];
};

export const SITES: Record<Site, { name: string; x: number; z: number }> = {
  L: { name: "LANDER", x: -7.8, z: 5.2 },
  C: { name: "CRATER", x: -4.2, z: -4.6 },
  R: { name: "RIDGE", x: 5.8, z: 4.3 },
  B: { name: "BEACON", x: 7, z: -5.5 },
};

export const ROUTES: ReadonlyArray<{
  from: Site;
  to: Site;
  oxygen: number;
  energy: number;
}> = [
  { from: "L", to: "R", oxygen: 1, energy: 2 },
  { from: "L", to: "C", oxygen: 2, energy: 1 },
  { from: "R", to: "B", oxygen: 1, energy: 1 },
  { from: "C", to: "B", oxygen: 1, energy: 1 },
  { from: "B", to: "R", oxygen: 1, energy: 1 },
  { from: "B", to: "C", oxygen: 1, energy: 1 },
  { from: "R", to: "L", oxygen: 1, energy: 2 },
];

export function newMission(): MissionState {
  return {
    position: "L",
    oxygen: 6,
    energy: 5,
    repaired: false,
    status: "active",
    pending: null,
    events: [],
    revision: 0,
  };
}

export function availableRoute(state: MissionState, destination: Site) {
  if (state.position === "B" && destination === "C") return null;
  if (state.position === "B" && !state.repaired) return null;
  return ROUTES.find((route) => route.from === state.position && route.to === destination) ?? null;
}

function appendEvent(state: MissionState, event: Omit<MissionEvent, "id">): MissionState {
  return {
    ...state,
    revision: state.revision + 1,
    events: [...state.events, { ...event, id: state.revision + 1 }],
  };
}

export function propose(
  state: MissionState,
  action: Action,
  actor: string,
  now: number,
): MissionState {
  if (state.status !== "active") throw new Error("Mission already ended");
  if (state.pending && state.pending.expiresAt > now) throw new Error("A proposal is already pending");
  if (action.type === "repair") {
    if (state.position !== "B" || state.repaired) throw new Error("Beacon is not ready for repair");
  } else if (!availableRoute(state, action.destination)) {
    throw new Error("Route is unavailable");
  }
  return {
    ...state,
    pending: { action, proposedBy: actor, expiresAt: now + 90_000 },
    revision: state.revision + 1,
  };
}

export function confirm(state: MissionState, actor: string, now: number): MissionState {
  const pending = state.pending;
  if (state.status !== "active" || !pending) throw new Error("No active proposal");
  if (pending.proposedBy === actor) throw new Error("A teammate must confirm");
  if (pending.expiresAt <= now) throw new Error("Proposal expired");

  if (pending.action.type === "repair") {
    return appendEvent(
      { ...state, repaired: true, pending: null },
      { at: now, actor, kind: "repair", text: "Beacon signal restored" },
    );
  }

  const route = availableRoute(state, pending.action.destination);
  if (!route) throw new Error("Route is unavailable");
  const oxygen = state.oxygen - route.oxygen;
  const energy = state.energy - route.energy;
  const status: MissionStatus =
    oxygen < 0 || energy < 0
      ? "lost"
      : route.to === "L" && state.repaired
        ? "won"
        : "active";
  const moved = appendEvent(
    { ...state, position: route.to, oxygen, energy, pending: null, status },
    {
      at: now,
      actor,
      kind: "move",
      text: `${SITES[route.from].name} → ${SITES[route.to].name}`,
      from: route.from,
      to: route.to,
    },
  );
  if (status === "active") return moved;
  return appendEvent(moved, {
    at: now,
    actor,
    kind: status,
    text: status === "won" ? "Relay restored. Crew returned safely." : "Resources exhausted on the lunar surface.",
  });
}

export function restart(state: MissionState, actor: string, now: number): MissionState {
  return appendEvent({ ...newMission(), seenMessages: state.seenMessages }, {
    at: now,
    actor,
    kind: "restart",
    text: `New attempt after ${state.status} mission`,
  });
}

export function publicMission(state: MissionState) {
  const { seenMessages: _seenMessages, ...visible } = state;
  return visible;
}

export function roleBrief(role: Role) {
  return role === "navigator"
    ? {
        heading: "Shadow forecast",
        description: "After you reach the beacon, lunar night closes the route back through the crater. Return by the ridge.",
      }
    : {
        heading: "Energy survey",
        description: "Lander → Ridge and Ridge → Lander each cost 2 energy. All other legs cost 1. Going out through the ridge leaves too little energy to return.",
      };
}
