import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Clipboard,
  Compass,
  ExternalLink,
  Flag,
  LoaderCircle,
  Moon,
  Pause,
  Play,
  Plus,
  Rocket,
  Radio,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  changeMoonProject,
  createMoonProject,
  getMoonProject,
  joinMoonProject,
} from "./project.functions";
import {
  applyProjectAction,
  buildingKinds,
  buildingNames,
  newProject,
  progress,
  suggestedBuilding,
  taskBuilding,
  type BuildingKind,
  type MoonTask,
  type ProjectAction,
  type ProjectState,
} from "./project";
import type { ProjectView } from "./project.store.server";
import { crewColors } from "./village-model";
import {
  missionComplete,
  voyageChapter,
  voyageCopy,
  voyageDurations,
  type Voyage,
} from "./moon-experience";
import "./project.css";

const MoonScene = lazy(() =>
  import("./MoonScene").then((module) => ({ default: module.MoonScene })),
);
type Mode = "home" | "live" | "local";

function sampleState() {
  let state = newProject("Hackathon weekend", "Build and demo a shared Moon for a real team.");
  const examples = [
    ["Define the problem", "One sentence naming the audience and problem", 1],
    ["Sketch the experience", "Share a clickable flow or screen sketch", 2],
    ["Build the core interaction", "A teammate can complete the primary flow", 1],
    ["Connect the agent", "A real message reaches the group through Spectrum", 2],
    ["Test the demo", "Record a working desktop and mobile walkthrough", 1],
    ["Submit the project", "Upload link, source, description and demo before noon", 2],
  ] as const;
  for (const [title, acceptance, owner] of examples) {
    state = applyProjectAction(state, { type: "add", title, acceptance }, 1, [1, 2], Date.now());
    state = applyProjectAction(
      state,
      { type: "assign", taskId: state.tasks.at(-1)!.id, owner },
      1,
      [1, 2],
      Date.now(),
    );
  }
  state = applyProjectAction(state, { type: "launch" }, 1, [1, 2], Date.now());
  state = applyProjectAction(
    state,
    {
      type: "submit",
      taskId: state.tasks[0].id,
      evidence: "Problem statement shared with the team",
    },
    1,
    [1, 2],
    Date.now(),
  );
  state = applyProjectAction(
    state,
    { type: "approve", taskId: state.tasks[0].id },
    2,
    [1, 2],
    Date.now(),
  );
  state = applyProjectAction(
    state,
    { type: "submit", taskId: state.tasks[1].id, evidence: "Prototype link ready for review" },
    2,
    [1, 2],
    Date.now(),
  );
  return state;
}

function localView(state: ProjectState, slot: number): ProjectView {
  return {
    code: "LOCALMOON",
    state,
    slot,
    crew: [
      { slot: 1, name: "You / Planner", bound: false },
      { slot: 2, name: "Teammate / Reviewer", bound: false },
    ],
    pairCode: "",
    bindCode: "",
    paired: false,
  };
}

function projectFromUrl() {
  return new URLSearchParams(window.location.search).get("project")?.toUpperCase() ?? "";
}

function duration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function taskLabel(task: MoonTask) {
  return task.status === "approved"
    ? "Revealed"
    : task.status === "submitted"
      ? "In review"
      : task.status === "focusing"
        ? "Scanning"
        : task.blocker
          ? "Needs help"
          : "Unexplored";
}

export function ProjectApp() {
  const preview = useMemo(sampleState, []);
  const [mode, setMode] = useState<Mode>("home");
  const [view, setView] = useState<ProjectView | null>(null);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [buildingKind, setBuildingKind] = useState<BuildingKind | "suggested">("suggested");
  const [acceptance, setAcceptance] = useState("");
  const [evidence, setEvidence] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voyage, setVoyage] = useState<Voyage | null>(null);
  const [voyageStartedAt, setVoyageStartedAt] = useState(0);
  const [arrived, setArrived] = useState(false);
  const voyageTimer = useRef<number | null>(null);
  const lastCompletion = useRef<{ code: string; complete: boolean } | null>(null);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [reset, setReset] = useState(0);
  const [focus, setFocus] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(max-width: 720px)").matches,
  );
  const [localSlot, setLocalSlot] = useState(1);
  const [joining, setJoining] = useState(false);
  const state =
    view?.state ?? newProject("Your shared Moon", "Start a project to chart its sectors.");
  const selected = state.tasks.find((task) => task.id === selectedId) ?? null;
  const { approved, total } = progress(state);
  const slot = mode === "local" ? localSlot : (view?.slot ?? 0);
  const liveCode = mode === "live" ? view?.code : undefined;

  const stopVoyage = useCallback((destination: Voyage | null = null) => {
    if (voyageTimer.current !== null) window.clearTimeout(voyageTimer.current);
    voyageTimer.current = null;
    setVoyage(null);
    if (destination === "homebound") setArrived(true);
  }, []);

  useEffect(
    () => () => {
      if (voyageTimer.current !== null) window.clearTimeout(voyageTimer.current);
    },
    [],
  );

  const startVoyage = useCallback(
    (direction: Voyage, key?: string) => {
      stopVoyage();
      if (direction === "outbound" && key && sessionStorage.getItem(`moon-voyage-${key}`)) return;
      if (direction === "outbound" && key) sessionStorage.setItem(`moon-voyage-${key}`, "1");
      if (reducedMotion) {
        if (direction === "homebound") setArrived(true);
        return;
      }
      setArrived(false);
      setVoyageStartedAt(performance.now());
      setVoyage(direction);
      voyageTimer.current = window.setTimeout(
        () => stopVoyage(direction),
        voyageDurations[direction] * 1000,
      );
    },
    [reducedMotion, stopVoyage],
  );

  const enter = useCallback(
    (next: ProjectView) => {
      stopVoyage();
      setView(next);
      setMode("live");
      setSelectedId(null);
      setError("");
      history.replaceState(null, "", `/?project=${encodeURIComponent(next.code)}`);
      const complete = missionComplete(next.state);
      setArrived(complete);
      if (!complete) startVoyage("outbound", next.code);
    },
    [startVoyage, stopVoyage],
  );

  useEffect(() => {
    const projectCode = projectFromUrl();
    if (!projectCode) return;
    setCode(projectCode);
    getMoonProject({ data: { code: projectCode } })
      .then(enter)
      .catch(() => setJoining(true));
  }, [enter]);

  useEffect(() => {
    if (!liveCode) return;
    let active = true;
    const timer = window.setInterval(() => {
      getMoonProject({ data: { code: liveCode } })
        .then((next) => {
          if (active) setView(next);
        })
        .catch(() => {
          /* Keep the last valid project during a network interruption. */
        });
    }, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [liveCode]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!view || mode === "home") {
      lastCompletion.current = null;
      return;
    }
    const complete = missionComplete(view.state);
    if (
      lastCompletion.current?.code === view.code &&
      !lastCompletion.current.complete &&
      complete
    ) {
      startVoyage("homebound");
    }
    lastCompletion.current = { code: view.code, complete };
  }, [view, mode, startVoyage]);

  async function create() {
    setLoading(true);
    setError("");
    try {
      enter(await createMoonProject({ data: { title, goal, name } }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create project");
    } finally {
      setLoading(false);
    }
  }

  async function join() {
    setLoading(true);
    setError("");
    try {
      enter(await joinMoonProject({ data: { code: code.trim().toUpperCase(), name } }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join project");
    } finally {
      setLoading(false);
    }
  }

  function startLocal() {
    let state = sampleState();
    try {
      const saved = localStorage.getItem("moon-local-demo");
      if (saved) state = JSON.parse(saved) as ProjectState;
    } catch {
      /* Restore a fresh sample if local data is damaged. */
    }
    setView(localView(state, 1));
    setLocalSlot(1);
    setMode("local");
    setError("");
    setSelectedId(state.tasks[1]?.id ?? null);
    history.replaceState(null, "", "/");
    setArrived(missionComplete(state));
    if (!missionComplete(state)) startVoyage("outbound", "LOCAL");
  }

  async function act(action: ProjectAction) {
    if (!view) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "local") {
        const next = applyProjectAction(view.state, action, localSlot, [1, 2], Date.now());
        localStorage.setItem("moon-local-demo", JSON.stringify(next));
        setView(localView(next, localSlot));
        if (action.type === "add") setSelectedId(next.tasks.at(-1)!.id);
      } else {
        setView(await changeMoonProject({ data: { code: view.code, action } }));
        if (action.type === "add") setSelectedId(null);
      }
      if (action.type === "add") {
        setTaskTitle("");
        setAcceptance("");
        setBuildingKind("suggested");
      }
      if (action.type === "submit") setEvidence("");
      if (action.type === "block" || action.type === "reject") setReason("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update project");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setError("");
    } catch {
      setError("Clipboard unavailable. Select the code manually.");
    }
  }

  function selectTask(id: string) {
    setSelectedId(id);
    setFocus((value) => value + 1);
    if (window.matchMedia("(max-width: 720px)").matches) setPanelOpen(true);
  }

  function leave() {
    setMode("home");
    setView(null);
    setSelectedId(null);
    stopVoyage();
    setArrived(false);
    lastCompletion.current = null;
    setJoining(false);
    setError("");
    history.replaceState(null, "", "/");
  }

  return (
    <div className="moon-app">
      <div className="moon-stage" aria-label="Interactive shared Moon">
        <Suspense
          fallback={<div className="moon-scene-fallback">Bringing the Moon into view…</div>}
        >
          <MoonScene
            tasks={mode === "home" ? preview.tasks : state.tasks}
            crewSlots={mode === "home" ? [1, 2] : (view?.crew.map((member) => member.slot) ?? [])}
            selectedId={selectedId}
            onSelect={selectTask}
            intro={false}
            reset={reset}
            focus={focus}
            voyage={voyage}
            voyageStartedAt={voyageStartedAt}
            arrived={arrived}
            constructionRate={mode === "local" ? 150 : 1}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </div>
      <header className="moon-header">
        <button className="moon-brand" onClick={leave} aria-label="Common Moon home">
          <span className="moon-brand-icon">
            <Moon size={21} />
          </span>
          <span>
            common<span>moon</span>
          </span>
        </button>
        <div className="moon-header-center">
          {mode === "home" ? "A shared space for your next project" : state.title}
        </div>
        <div className="moon-header-tools">
          {mode !== "home" && (
            <button
              className="moon-tool"
              onClick={() => setReset((value) => value + 1)}
              aria-label="Reset Moon view"
              title="Reset Moon view"
            >
              <Compass size={18} />
            </button>
          )}
          {mode !== "home" && (
            <button
              className="moon-tool moon-panel-toggle"
              onClick={() => setPanelOpen((value) => !value)}
              aria-label="Toggle task panel"
              title="Toggle task panel"
            >
              <ChevronDown size={18} />
            </button>
          )}
          <a
            className="moon-tool"
            href="/?tutorial=1"
            title="Open rescue tutorial"
            aria-label="Open rescue tutorial"
          >
            <CircleHelp size={18} />
          </a>
        </div>
      </header>

      {mode === "home" ? (
        <main className="moon-onboard">
          <div className="moon-eyebrow">
            <span className="moon-small-dot" /> COMMON MOON / 共月
          </div>
          <h1>
            Make a moon
            <br />
            <em>together.</em>
          </h1>
          <p className="moon-intent">
            Same project. Different places. One moon that comes into view as your team delivers.
          </p>
          <div className="moon-home-tabs" role="tablist" aria-label="Get started">
            <button
              role="tab"
              aria-selected={!joining}
              className={!joining ? "active" : ""}
              onClick={() => setJoining(false)}
            >
              Create
            </button>
            <button
              role="tab"
              aria-selected={joining}
              className={joining ? "active" : ""}
              onClick={() => setJoining(true)}
            >
              Join a crew
            </button>
          </div>
          {joining ? (
            <form
              className="moon-form"
              onSubmit={(event) => {
                event.preventDefault();
                void join();
              }}
            >
              <label>
                Invite code
                <input
                  value={code}
                  maxLength={10}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="10-character code"
                  required
                />
              </label>
              <label>
                Your name
                <input
                  value={name}
                  maxLength={50}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="How your crew knows you"
                  required
                />
              </label>
              <button className="moon-primary" disabled={loading || code.trim().length !== 10}>
                {loading ? (
                  <LoaderCircle className="moon-spin" size={17} />
                ) : (
                  <ArrowRight size={17} />
                )}{" "}
                Join project
              </button>
            </form>
          ) : (
            <form
              className="moon-form"
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <label>
                Project name
                <input
                  value={title}
                  maxLength={80}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="What are you building?"
                  required
                />
              </label>
              <label>
                Shared goal
                <textarea
                  value={goal}
                  maxLength={500}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="What will be true when this is done?"
                  rows={2}
                  required
                />
              </label>
              <label>
                Your name
                <input
                  value={name}
                  maxLength={50}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="How your crew knows you"
                  required
                />
              </label>
              <button className="moon-primary" disabled={loading}>
                {loading ? <LoaderCircle className="moon-spin" size={17} /> : <Plus size={17} />}{" "}
                Create shared Moon
              </button>
            </form>
          )}
          <button className="moon-sample" onClick={startLocal}>
            <Sparkles size={16} /> Explore interactive sample <ArrowRight size={16} />
          </button>
          {error && (
            <p className="moon-error" role="alert">
              {error}
            </p>
          )}
          <p className="moon-verse">
            千里共婵娟 <span>·</span> Under one moon, wherever we are.
          </p>
        </main>
      ) : (
        <>
          <div className="moon-overview">
            <span className="moon-kicker">
              {mode === "local" ? "LOCAL SIMULATION" : `PROJECT ${view?.code}`}
            </span>
            <h1>{state.title}</h1>
            <p>{state.goal}</p>
            <div className="moon-completion">
              <span>
                {approved} <small>/ {total || "—"} sectors revealed</small>
              </span>
              <div>
                <i style={{ width: `${total ? (approved / total) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="moon-people">
              {view?.crew.map((member) => (
                <span
                  key={member.slot}
                  title={`Crew ${member.slot}: ${member.name}`}
                  className={slot === member.slot ? "is-me" : ""}
                >
                  <UserRound size={14} /> {member.name}
                </span>
              ))}
            </div>
            {total > 0 && approved === total && (
              <p className="moon-complete">
                <CheckCheck size={16} /> Your moon is whole. Time to go home.
              </p>
            )}
          </div>
          <div className="moon-bottom-note">
            <span>
              {state.phase === "planning" ? "CHARTING THE MOON" : "DRAG TO ORBIT · SCROLL TO ZOOM"}
            </span>
            <span>NASA SCIENTIFIC VISUALIZATION STUDIO</span>
          </div>
          <aside className={`moon-panel ${panelOpen ? "is-open" : ""}`} aria-label="Project tasks">
            <button
              className="moon-panel-handle"
              onClick={() => setPanelOpen((value) => !value)}
              aria-label="Toggle tasks"
            >
              <span>
                <ChevronDown size={18} /> Project & tasks
              </span>
              <span>
                {approved}/{total}
              </span>
            </button>
            <div className="moon-panel-scroll">
              <div className="moon-panel-heading">
                <div>
                  <span className="moon-kicker">
                    {state.phase === "planning" ? "BEFORE LAUNCH" : "SHARED PROGRESS"}
                  </span>
                  <h2>
                    {state.phase === "planning" ? "Chart your sectors" : "The Moon, together"}
                  </h2>
                </div>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="moon-close"
                  aria-label="Close task panel"
                >
                  <X size={18} />
                </button>
              </div>
              {mode === "local" && (
                <div className="moon-local">
                  Interactive sample · Stored in this browser. No Telegram messages are sent.
                  <p className="moon-demo-note">
                    Construction preview is accelerated. Focus time and review rules are not.
                  </p>
                  <div className="moon-segment" aria-label="Simulated crew seat">
                    <button
                      className={localSlot === 1 ? "active" : ""}
                      onClick={() => setLocalSlot(1)}
                    >
                      Planner
                    </button>
                    <button
                      className={localSlot === 2 ? "active" : ""}
                      onClick={() => setLocalSlot(2)}
                    >
                      Reviewer
                    </button>
                  </div>
                  <button
                    className="moon-text-button"
                    onClick={() => {
                      const fresh = sampleState();
                      localStorage.setItem("moon-local-demo", JSON.stringify(fresh));
                      setView(localView(fresh, localSlot));
                      setSelectedId(fresh.tasks[1].id);
                    }}
                  >
                    <RotateCcw size={14} /> Reset sample
                  </button>
                </div>
              )}
              {state.phase === "planning" && (
                <>
                  <p className="moon-help">
                    Each task becomes a fixed sector when your crew launches. Write how you will
                    know it is done.
                  </p>
                  {slot === 1 && (
                    <form
                      className="moon-task-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void act({
                          type: "add",
                          title: taskTitle,
                          acceptance,
                          buildingKind:
                            buildingKind === "suggested"
                              ? suggestedBuilding(taskTitle)
                              : buildingKind,
                        });
                      }}
                    >
                      <label>
                        New task
                        <input
                          value={taskTitle}
                          maxLength={90}
                          onChange={(event) => setTaskTitle(event.target.value)}
                          placeholder="A concrete deliverable"
                          required
                        />
                      </label>
                      <label className="moon-select-label">
                        Building
                        <select
                          aria-label="Building type"
                          value={buildingKind}
                          onChange={(event) =>
                            setBuildingKind(event.target.value as BuildingKind | "suggested")
                          }
                        >
                          <option value="suggested">
                            Suggested: {buildingNames[suggestedBuilding(taskTitle)]}
                          </option>
                          {buildingKinds.map((kind) => (
                            <option key={kind} value={kind}>
                              {buildingNames[kind]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Done when
                        <textarea
                          value={acceptance}
                          maxLength={300}
                          onChange={(event) => setAcceptance(event.target.value)}
                          placeholder="What should a teammate verify?"
                          rows={2}
                          required
                        />
                      </label>
                      <button disabled={loading || total >= 24} className="moon-add">
                        <Plus size={16} /> Add sector
                      </button>
                    </form>
                  )}
                </>
              )}
              <div className="moon-list-title">
                <span>SECTORS</span>
                <span>{String(total).padStart(2, "0")}</span>
              </div>
              <div className="moon-task-list">
                {state.tasks.map((task, index) => (
                  <button
                    key={task.id}
                    className={`moon-task-row ${selectedId === task.id ? "selected" : ""}`}
                    onClick={() => selectTask(task.id)}
                  >
                    <span className={`moon-task-symbol is-${task.status}`}>
                      {task.status === "approved" ? (
                        <Check size={16} />
                      ) : (
                        String(index + 1).padStart(2, "0")
                      )}
                    </span>
                    <span className="moon-task-info">
                      <strong>{task.title}</strong>
                      <small>
                        {taskLabel(task)} ·{" "}
                        {view?.crew.find((member) => member.slot === task.owner)?.name ??
                          "Unassigned"}
                      </small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
                {!total && (
                  <p className="moon-empty">Your first task will mark a place on the Moon.</p>
                )}
              </div>
              {state.phase === "planning" && slot === 1 && (
                <button
                  className="moon-launch"
                  disabled={
                    loading ||
                    !total ||
                    view?.crew.length === 1 ||
                    state.tasks.some((task) => !task.owner)
                  }
                  onClick={() => void act({ type: "launch" })}
                >
                  <Flag size={17} /> Launch shared Moon <ArrowRight size={16} />
                </button>
              )}
              {state.phase === "planning" && (
                <p className="moon-help">
                  {view?.crew.length === 1
                    ? "Invite a teammate, then assign every sector."
                    : "Assign every sector before launch. The map locks at launch."}
                </p>
              )}

              {selected && (
                <section className="moon-inspector">
                  <div className="moon-list-title">
                    <span>SECTOR {String(state.tasks.indexOf(selected) + 1).padStart(2, "0")}</span>
                    <span>{taskLabel(selected).toUpperCase()}</span>
                  </div>
                  <h3>{selected.title}</h3>
                  <div className="moon-build-identity">
                    <span
                      className="moon-build-dot"
                      style={{
                        background: crewColors[((selected.owner ?? 1) - 1) % crewColors.length],
                      }}
                    />
                    {buildingNames[taskBuilding(selected)]}
                    <span>·</span>
                    {view?.crew.find((member) => member.slot === selected.owner)?.name ??
                      "Unassigned"}
                  </div>
                  {state.phase === "planning" && slot === 1 && (
                    <label className="moon-select-label">
                      Building
                      <select
                        aria-label="Building type"
                        value={taskBuilding(selected)}
                        onChange={(event) =>
                          void act({
                            type: "building",
                            taskId: selected.id,
                            buildingKind: event.target.value as BuildingKind,
                          })
                        }
                        disabled={loading}
                      >
                        {buildingKinds.map((kind) => (
                          <option key={kind} value={kind}>
                            {buildingNames[kind]}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="moon-criteria">
                    <strong>Done when</strong>
                    {selected.acceptance}
                  </p>
                  {state.phase === "planning" && slot === 1 && (
                    <label className="moon-select-label">
                      Assigned to
                      <select
                        value={selected.owner ?? ""}
                        onChange={(event) =>
                          void act({
                            type: "assign",
                            taskId: selected.id,
                            owner: Number(event.target.value),
                          })
                        }
                        disabled={loading}
                      >
                        <option value="" disabled>
                          Select a teammate
                        </option>
                        {view?.crew.map((member) => (
                          <option key={member.slot} value={member.slot}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {selected.blocker && (
                    <p className="moon-blocker">
                      <CircleHelp size={16} /> {selected.blocker}
                    </p>
                  )}
                  {selected.evidence && (
                    <p className="moon-evidence">
                      <strong>Submitted work</strong>
                      {selected.evidence.startsWith("https://") ? (
                        <a href={selected.evidence} target="_blank" rel="noreferrer">
                          {selected.evidence} <ExternalLink size={13} />
                        </a>
                      ) : (
                        selected.evidence
                      )}
                    </p>
                  )}
                  {state.phase === "launched" && selected.status === "focusing" && (
                    <div className="moon-timer">
                      <span>SCAN IN PROGRESS</span>
                      <strong>
                        {duration(
                          selected.focusMs + Math.max(0, now - (selected.focusStartedAt ?? now)),
                        )}
                      </strong>
                    </div>
                  )}
                  {state.phase === "launched" &&
                    selected.focusMs > 0 &&
                    selected.status !== "focusing" && (
                      <p className="moon-time-spent">
                        Focused {duration(selected.focusMs)} on this sector
                      </p>
                    )}
                  {state.phase === "launched" &&
                    selected.owner === slot &&
                    (selected.status === "todo" || selected.status === "focusing") && (
                      <>
                        <button
                          className="moon-action"
                          disabled={loading}
                          onClick={() =>
                            void act({
                              type: selected.status === "focusing" ? "pause" : "focus",
                              taskId: selected.id,
                            })
                          }
                        >
                          {selected.status === "focusing" ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                          {selected.status === "focusing" ? "Pause focus" : "Start focus scan"}
                        </button>
                        <form
                          className="moon-mini-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void act({ type: "submit", taskId: selected.id, evidence });
                          }}
                        >
                          <label>
                            Work to review
                            <textarea
                              value={evidence}
                              onChange={(event) => setEvidence(event.target.value)}
                              maxLength={1000}
                              placeholder="Result, notes, or a link"
                              rows={2}
                              required
                            />
                          </label>
                          <button className="moon-action is-primary" disabled={loading}>
                            <Send size={16} /> Submit for review
                          </button>
                        </form>
                        <form
                          className="moon-mini-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void act({ type: "block", taskId: selected.id, reason });
                          }}
                        >
                          <label>
                            Need help?
                            <input
                              value={reason}
                              onChange={(event) => setReason(event.target.value)}
                              maxLength={300}
                              placeholder="What's blocking you?"
                              required
                            />
                          </label>
                          <button className="moon-text-button" disabled={loading}>
                            <CircleHelp size={15} /> Ask crew for help
                          </button>
                        </form>
                      </>
                    )}
                  {state.phase === "launched" &&
                    selected.status === "submitted" &&
                    selected.owner !== slot && (
                      <div className="moon-review">
                        <button
                          className="moon-action is-primary"
                          disabled={loading}
                          onClick={() => void act({ type: "approve", taskId: selected.id })}
                        >
                          <Check size={16} /> Approve & reveal
                        </button>
                        <form
                          className="moon-mini-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void act({ type: "reject", taskId: selected.id, reason });
                          }}
                        >
                          <label>
                            What needs another pass?
                            <input
                              value={reason}
                              onChange={(event) => setReason(event.target.value)}
                              maxLength={300}
                              required
                            />
                          </label>
                          <button className="moon-text-button" disabled={loading}>
                            <ArrowLeft size={15} /> Return with feedback
                          </button>
                        </form>
                      </div>
                    )}
                  {state.phase === "launched" &&
                    selected.status === "submitted" &&
                    selected.owner === slot && (
                      <p className="moon-help">A teammate can review and reveal this sector.</p>
                    )}
                  {selected.status === "approved" && (
                    <p className="moon-revealed">
                      <CheckCheck size={18} /> Revealed by{" "}
                      {view?.crew.find((member) => member.slot === selected.reviewedBy)?.name}
                    </p>
                  )}
                </section>
              )}
              {mode === "live" && (
                <section className="moon-connection">
                  <div className="moon-list-title">
                    <span>
                      <Radio size={14} /> TELEGRAM CREW
                    </span>
                    <span>{view?.paired ? "CONNECTED" : "NOT PAIRED"}</span>
                  </div>
                  <p>
                    Bring the Photon mission agent into your Telegram group. Teammates can plan,
                    report blockers and review work there.
                  </p>
                  <button
                    onClick={() => void copy(`${window.location.origin}/?project=${view?.code}`)}
                  >
                    <ExternalLink size={15} /> Copy project invite
                  </button>
                  <button onClick={() => void copy(`/pair ${view?.pairCode}`)}>
                    <Clipboard size={15} /> Copy /pair {view?.pairCode}
                  </button>
                  <button onClick={() => void copy(`/bind ${view?.bindCode}`)}>
                    <Clipboard size={15} /> Copy your /bind code
                  </button>
                </section>
              )}
              <div className="moon-history">
                <div className="moon-list-title">
                  <span>RECENT ACTIVITY</span>
                  <span>{String(state.events.length).padStart(2, "0")}</span>
                </div>
                {[...state.events]
                  .reverse()
                  .slice(0, 5)
                  .map((event) => (
                    <p key={event.id}>{event.text}</p>
                  ))}
              </div>
              {error && (
                <p className="moon-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          </aside>
        </>
      )}
      {voyage &&
        (() => {
          const elapsed = Math.max(0, (performance.now() - voyageStartedAt) / 1000);
          const chapter = voyageChapter(voyage, elapsed);
          const [label, heading, detail] = voyageCopy[voyage][chapter];
          return (
            <div className="moon-voyage" aria-live="polite">
              <span className="moon-voyage-brand">
                COMMON MOON <span>/ 共月</span>
              </span>
              <div className="moon-voyage-copy" key={`${voyage}-${chapter}`}>
                <p>{label}</p>
                <strong>{heading}</strong>
                <span>{detail}</span>
              </div>
              <div className="moon-voyage-bottom">
                <span>{voyage === "outbound" ? "EARTH → MOON" : "MOON → EARTH"}</span>
                {voyage === "homebound" && (
                  <small>A visual sky journal, not a live astronomical forecast.</small>
                )}
                <button onClick={() => stopVoyage(voyage)}>
                  Skip <ArrowRight size={17} />
                </button>
              </div>
              <div className="moon-voyage-track">
                <i key={voyage} style={{ animationDuration: `${voyageDurations[voyage]}s` }} />
              </div>
            </div>
          );
        })()}
      {arrived && !voyage && mode !== "home" && (
        <div className="moon-arrival" aria-live="polite">
          <div className="moon-arrival-top">
            COMMON MOON <span>/ 返航记录</span>
          </div>
          <div className="moon-arrival-copy">
            <span className="moon-kicker">MISSION COMPLETE / EARTH</span>
            <h2>
              Welcome
              <br />
              <em>home.</em>
            </h2>
            <p>{state.title}</p>
            <span>
              {approved} of {total} pieces built and reviewed together.
            </span>
            <div className="moon-arrival-actions">
              <button className="moon-primary" onClick={() => setArrived(false)}>
                View our Moon <ArrowRight size={17} />
              </button>
              <button className="moon-arrival-secondary" onClick={leave}>
                Start a new project <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="moon-arrival-bottom">
            <span>千里共婵娟</span>
            <span>NASA BLUE MARBLE / MOON KIT</span>
          </div>
        </div>
      )}
      {mode !== "home" && !arrived && !voyage && missionComplete(state) && (
        <button className="moon-return" onClick={() => startVoyage("homebound")}>
          <Rocket size={17} /> Return to Earth
        </button>
      )}
    </div>
  );
}
