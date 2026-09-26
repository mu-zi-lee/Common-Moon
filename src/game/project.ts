export type TaskStatus = "todo" | "focusing" | "submitted" | "approved";

export type MoonTask = {
  id: string;
  title: string;
  acceptance: string;
  owner: number | null;
  status: TaskStatus;
  focusStartedAt: number | null;
  focusMs: number;
  evidence: string;
  blocker: string;
  reviewedBy: number | null;
};

export type ProjectState = {
  title: string;
  goal: string;
  phase: "planning" | "launched";
  tasks: MoonTask[];
  events: { id: string; text: string; at: number }[];
};

export type ProjectAction =
  | { type: "add"; title: string; acceptance: string }
  | { type: "assign"; taskId: string; owner: number }
  | { type: "launch" }
  | { type: "focus"; taskId: string }
  | { type: "pause"; taskId: string }
  | { type: "submit"; taskId: string; evidence: string }
  | { type: "approve"; taskId: string }
  | { type: "reject"; taskId: string; reason: string }
  | { type: "block"; taskId: string; reason: string };

export function newProject(title: string, goal: string): ProjectState {
  if (!title.trim() || !goal.trim()) throw new Error("Give the project a name and a concrete goal");
  return {
    title: title.trim().slice(0, 80),
    goal: goal.trim().slice(0, 500),
    phase: "planning",
    tasks: [],
    events: [],
  };
}

export function progress(state: ProjectState) {
  return {
    approved: state.tasks.filter((task) => task.status === "approved").length,
    total: state.tasks.length,
  };
}

export function applyProjectAction(
  state: ProjectState,
  action: ProjectAction,
  actor: number,
  memberSlots: number[],
  now: number,
): ProjectState {
  if (!memberSlots.includes(actor)) throw new Error("Join the project before changing it");
  const next: ProjectState = structuredClone(state);
  let log = "";
  if (action.type === "add") {
    if (next.phase !== "planning") throw new Error("The Moon map is locked after launch");
    if (actor !== 1) throw new Error("The project creator adds sectors");
    if (next.tasks.length >= 24) throw new Error("The Moon supports at most 24 sectors");
    const title = action.title.trim().slice(0, 90);
    const acceptance = action.acceptance.trim().slice(0, 300);
    if (!title || !acceptance) throw new Error("A task needs a title and acceptance criteria");
    next.tasks.push({
      id: crypto.randomUUID(),
      title,
      acceptance,
      owner: null,
      status: "todo",
      focusStartedAt: null,
      focusMs: 0,
      evidence: "",
      blocker: "",
      reviewedBy: null,
    });
    log = `Sector ${next.tasks.length} charted: ${title}`;
  } else if (action.type === "launch") {
    if (actor !== 1) throw new Error("Only the project creator can launch");
    if (next.phase !== "planning") throw new Error("Already launched");
    if (
      !next.tasks.length ||
      next.tasks.some((task) => !task.owner || !memberSlots.includes(task.owner))
    ) {
      throw new Error("Assign every task to a joined member before launch");
    }
    if (memberSlots.length < 2) throw new Error("Invite a teammate before launch");
    next.phase = "launched";
    log = `Moon map launched with ${next.tasks.length} sectors`;
  } else {
    const task = next.tasks.find((entry) => entry.id === action.taskId);
    if (!task) throw new Error("Sector not found");
    if (action.type === "assign") {
      if (next.phase !== "planning") throw new Error("Assignments lock at launch");
      if (actor !== 1) throw new Error("Only the project creator assigns tasks");
      if (!memberSlots.includes(action.owner)) throw new Error("That teammate has not joined");
      task.owner = action.owner;
      log = `${task.title} assigned to crew ${action.owner}`;
    } else {
      if (next.phase !== "launched") throw new Error("Launch the project first");
      if (action.type === "approve" || action.type === "reject") {
        if (task.status !== "submitted") throw new Error("This sector is not awaiting review");
        if (task.owner === actor) throw new Error("A teammate must review your work");
        if (action.type === "approve") {
          task.status = "approved";
          task.reviewedBy = actor;
          log = `${task.title} approved by crew ${actor}; sector revealed`;
        } else {
          if (!action.reason.trim()) throw new Error("Explain what needs another pass");
          task.status = "todo";
          task.blocker = action.reason.trim().slice(0, 300);
          task.evidence = "";
          log = `${task.title} returned for changes by crew ${actor}`;
        }
      } else {
        if (task.owner !== actor)
          throw new Error("Only the assigned teammate can work on this sector");
        if (task.status === "approved" || task.status === "submitted")
          throw new Error("This task is awaiting review or already approved");
        if (action.type === "focus") {
          if (task.status === "focusing") throw new Error("Already focusing");
          if (next.tasks.some((entry) => entry.owner === actor && entry.status === "focusing")) {
            throw new Error("Pause your current focus session first");
          }
          task.status = "focusing";
          task.focusStartedAt = now;
          log = `Crew ${actor} started scanning ${task.title}`;
        } else if (action.type === "pause") {
          if (task.status !== "focusing" || task.focusStartedAt === null)
            throw new Error("No active focus session");
          task.focusMs += Math.max(0, now - task.focusStartedAt);
          task.focusStartedAt = null;
          task.status = "todo";
          log = `Crew ${actor} paused ${task.title}`;
        } else if (action.type === "submit") {
          const evidence = action.evidence.trim().slice(0, 1000);
          if (!evidence)
            throw new Error("Describe the result or add a link for your teammate to review");
          if (task.focusStartedAt !== null) task.focusMs += Math.max(0, now - task.focusStartedAt);
          task.focusStartedAt = null;
          task.status = "submitted";
          task.evidence = evidence;
          task.blocker = "";
          log = `${task.title} submitted for teammate review`;
        } else if (action.type === "block") {
          if (!action.reason.trim()) throw new Error("Describe what is blocking progress");
          task.blocker = action.reason.trim().slice(0, 300);
          log = `Crew ${actor} needs help on ${task.title}`;
        }
      }
    }
  }
  if (log) next.events.push({ id: crypto.randomUUID(), text: log, at: now });
  next.events = next.events.slice(-100);
  return next;
}
