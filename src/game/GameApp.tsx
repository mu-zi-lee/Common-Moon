import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  ArrowRight, Check, ChevronDown, Clipboard, Compass, Expand, ExternalLink,
  Eye, Flag, Gauge, Info, LoaderCircle, Radio, RotateCcw, X, Zap,
} from "lucide-react";
import {
  confirm, newMission, propose, restart, roleBrief, ROUTES, SITES,
  type MissionState, type Role, type Site,
} from "./rules";
import { createLunarMission, getLunarMission, joinLunarMission } from "./mission.functions";
import type { RoomView } from "./store.server";
import "./game.css";

const LunarScene = lazy(() => import("./LunarScene").then((module) => ({ default: module.LunarScene })));
type Mode = "lobby" | "live" | "demo";

function readCode() {
  return new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "";
}

function demoView(state: MissionState): RoomView {
  return {
    code: "DEMO", state, role: "navigator", bindCode: null, pairCode: null,
    paired: false,
    crew: { navigator: true, engineer: true, navigatorBound: false, engineerBound: false },
  };
}

export function GameApp() {
  const [mode, setMode] = useState<Mode>("lobby");
  const [view, setView] = useState<RoomView | null>(null);
  const [roomInput, setRoomInput] = useState("");
  const [selected, setSelected] = useState<Site | null>(null);
  const [role, setRole] = useState<Role>("navigator");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [intro, setIntro] = useState(false);
  const [introPhase, setIntroPhase] = useState(0);
  const [resetView, setResetView] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(max-width: 720px)").matches,
  );
  const state = view?.state ?? newMission();
  const currentRole = mode === "demo" ? role : view?.role ?? null;
  const pending = state.pending && state.pending.expiresAt > now ? state.pending : null;
  const briefing = currentRole ? roleBrief(currentRole) : null;
  const selectedRoute = selected ? ROUTES.find((route) => route.from === state.position && route.to === selected) : null;
  const openRoute = selectedRoute && !(state.position === "B" && selected === "C") && (state.position !== "B" || state.repaired);
  const proposedDestination = selected === "B" && state.position === "B" && !state.repaired ? "repair" : selected;

  const startIntro = useCallback((code: string) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || sessionStorage.getItem(`lunar-intro-${code}`)) return;
    setIntro(true);
    setIntroPhase(0);
    sessionStorage.setItem(`lunar-intro-${code}`, "1");
    window.setTimeout(() => setIntroPhase(1), 900);
    window.setTimeout(() => setIntroPhase(2), 2500);
    window.setTimeout(() => { setIntroPhase(3); setIntro(false); }, 5200);
  }, []);

  const enterRoom = useCallback((next: RoomView) => {
    setView(next);
    setMode("live");
    setSelected(null);
    setError("");
    history.replaceState(null, "", `/?room=${encodeURIComponent(next.code)}`);
    startIntro(next.code);
  }, [startIntro]);

  useEffect(() => {
    const code = readCode();
    if (!code) return;
    getLunarMission({ data: { code } }).then(enterRoom)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Mission unavailable"));
  }, [enterRoom]);

  useEffect(() => {
    if (mode !== "live" || !view) return;
    let active = true;
    const id = window.setInterval(() => {
      getLunarMission({ data: { code: view.code } })
        .then((next) => { if (active) setView(next); })
        .catch(() => { /* Keep the last valid state during a network interruption. */ });
    }, 2500);
    return () => { active = false; window.clearInterval(id); };
  }, [mode, view?.code]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  async function createRoom() {
    setLoading(true); setError("");
    try { enterRoom(await createLunarMission()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create mission"); }
    finally { setLoading(false); }
  }

  async function joinRoom() {
    setLoading(true); setError("");
    try { enterRoom(await joinLunarMission({ data: { code: roomInput.trim().toUpperCase() } })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not join mission"); }
    finally { setLoading(false); }
  }

  function startDemo() {
    let state = newMission();
    try {
      const saved = localStorage.getItem("lunar-demo");
      if (saved) state = JSON.parse(saved) as MissionState;
    } catch { /* A corrupted demo starts afresh. */ }
    setView(demoView(state));
    setRole("navigator");
    setMode("demo");
    setSelected(null);
    setError("");
    history.replaceState(null, "", "/");
    startIntro("DEMO");
  }

  function demoAction(operation: "propose" | "confirm" | "restart") {
    if (mode !== "demo" || !view) return;
    try {
      const timestamp = Date.now();
      const next = operation === "restart"
        ? restart(state, role, timestamp)
        : operation === "confirm"
          ? confirm(state, role, timestamp)
          : propose(
              state,
              proposedDestination === "repair"
                ? { type: "repair" }
                : { type: "move", destination: proposedDestination as Site },
              role,
              timestamp,
            );
      setView(demoView(next));
      localStorage.setItem("lunar-demo", JSON.stringify(next));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action unavailable");
    }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setError(""); }
    catch { setError("Clipboard unavailable. Select the code manually."); }
  }

  function leave() {
    setMode("lobby"); setView(null); setIntro(false); setError("");
    history.replaceState(null, "", "/");
  }

  function inspectSite(site: Site) {
    setSelected(site);
    if (window.matchMedia("(max-width: 720px)").matches) setPanelOpen(true);
  }

  const locationText = state.position === "B" && !state.repaired
    ? "Restore the relay before moving on"
    : state.status === "won" ? "Signal restored. Crew recovered."
      : state.status === "lost" ? "Mission lost. Reset to try another route."
        : "Choose the next location together";

  return (
    <div className="lunar-app">
      <div className="lunar-scene" aria-label="Interactive lunar mission terrain">
        <Suspense fallback={<div className="lunar-scene-fallback">Loading lunar terrain…</div>}>
          <LunarScene state={state} role={currentRole} selected={selected}
            onSelect={inspectSite} introActive={intro} resetView={resetView} />
        </Suspense>
      </div>
      <header className="lunar-header">
        <button className="lunar-brand" onClick={leave} aria-label="Lunar Relay home">
          <span className="lunar-brand-mark" aria-hidden="true"><Radio size={21} strokeWidth={1.7} /></span>
          <span>LUNAR<span className="lunar-brand-light">RELAY</span></span>
        </button>
        <div className="lunar-header-meta"><span className="lunar-live-dot" />
          <span>{mode === "lobby" ? "MISSION CONTROL" : mode === "demo" ? "LOCAL SIMULATION" : `MISSION ${view?.code}`}</span>
          {mode !== "lobby" && <span className="lunar-phase">0{state.repaired ? "3" : state.position === "L" ? "1" : "2"} / 03</span>}
        </div>
        <div className="lunar-header-actions">
          <button className="lunar-icon-button" onClick={() => setResetView((value) => value + 1)} title="Reset camera" aria-label="Reset camera"><Compass size={18} /></button>
          {mode !== "lobby" && <button className="lunar-icon-button" onClick={() => setPanelOpen((value) => !value)} title="Toggle mission panel" aria-label="Toggle mission panel"><Expand size={18} /></button>}
        </div>
      </header>

      {mode === "lobby" ? (
        <section className="lunar-lobby">
          <p className="lunar-overline">TRANSMISSION 001 / RECOVERY MISSION</p>
          <h1>Find the signal.<br /><span>Find your way home.</span></h1>
          <p className="lunar-lobby-summary">Two crew members. One lunar surface. The navigator knows the shadows; the engineer knows what the journey will cost.</p>
          <div className="lunar-lobby-actions">
            <button className="lunar-primary" onClick={createRoom} disabled={loading}>
              {loading ? <LoaderCircle size={17} className="lunar-spin" /> : <Flag size={17} />}
              CREATE MISSION <ArrowRight size={17} />
            </button>
            <button className="lunar-secondary" onClick={startDemo}><Eye size={17} /> EXPLORE LOCAL DEMO</button>
          </div>
          <form className="lunar-join" onSubmit={(event) => { event.preventDefault(); void joinRoom(); }}>
            <label htmlFor="room-code">JOIN YOUR CREW</label>
            <div><input id="room-code" value={roomInput} onChange={(event) => setRoomInput(event.target.value.toUpperCase())} maxLength={10} autoComplete="off" placeholder="MISSION CODE" /><button type="submit" disabled={loading || roomInput.trim().length !== 10} title="Join mission" aria-label="Join mission"><ArrowRight size={20} /></button></div>
          </form>
          {error && <p className="lunar-error" role="alert">{error}</p>}
          <p className="lunar-lobby-footer">SECTOR 07 / THE FAR SIDE IS QUIET</p>
        </section>
      ) : (
        <>
          <section className="lunar-status" aria-label="Mission resources">
            <div className="lunar-resource"><span><Gauge size={15} /> OXYGEN</span><strong>{Math.max(0, state.oxygen)}<small> / 6</small></strong><div className="lunar-meter"><i style={{ width: `${Math.max(0, state.oxygen) / 6 * 100}%` }} /></div></div>
            <div className="lunar-resource"><span><Zap size={15} /> ENERGY</span><strong>{Math.max(0, state.energy)}<small> / 5</small></strong><div className="lunar-meter is-energy"><i style={{ width: `${Math.max(0, state.energy) / 5 * 100}%` }} /></div></div>
            <div className="lunar-telemetry"><span>POSITION</span><strong>{state.position} / {SITES[state.position].name}</strong></div>
          </section>

          <nav className="lunar-locations" aria-label="Lunar locations">
            {(Object.keys(SITES) as Site[]).map((site) => (
              <button key={site} className={selected === site ? "is-selected" : ""} onClick={() => inspectSite(site)}>
                <span>{site}</span>{SITES[site].name}
                {state.position === site && <i aria-label="Current position" />}
              </button>
            ))}
          </nav>

          <div className={`lunar-panel ${panelOpen ? "is-open" : ""}`}>
            <div className="lunar-panel-handle"><button onClick={() => setPanelOpen((value) => !value)} aria-label="Toggle mission details"><ChevronDown size={18} /><span>MISSION BRIEFING</span></button></div>
            <div className="lunar-panel-content">
              <div className="lunar-panel-heading">
                <p className="lunar-overline">MISSION / {state.status === "active" ? "IN PROGRESS" : state.status.toUpperCase()}</p>
                <h2>{state.status === "won" ? "Home again." : state.status === "lost" ? "Signal lost." : state.repaired ? "Bring them home." : "Restore the beacon."}</h2>
                <p>{locationText}</p>
              </div>
              <div className="lunar-crew">
                <div className="lunar-section-title"><span>CREW</span><span>{view?.crew.engineer ? "02 / 02" : "01 / 02"}</span></div>
                <div className="lunar-crew-row"><span className="lunar-crew-icon">N</span><span>NAVIGATOR</span><small>{mode === "demo" || view?.crew.navigatorBound ? "ONLINE" : "AWAITING RADIO"}</small></div>
                <div className="lunar-crew-row"><span className="lunar-crew-icon is-engineer">E</span><span>ENGINEER</span><small>{!view?.crew.engineer ? "AWAITING CREW" : mode === "demo" || view.crew.engineerBound ? "ONLINE" : "AWAITING RADIO"}</small></div>
              </div>
              {mode === "demo" && <div className="lunar-role-switch" aria-label="Demo role"><button className={role === "navigator" ? "active" : ""} onClick={() => setRole("navigator")}>NAVIGATOR</button><button className={role === "engineer" ? "active" : ""} onClick={() => setRole("engineer")}>ENGINEER</button></div>}
              <section className="lunar-brief">
                <div className="lunar-section-title"><span>{briefing ? "EYES ONLY / " + currentRole?.toUpperCase() : "PUBLIC CHANNEL"}</span><Info size={14} /></div>
                <h3>{briefing?.heading ?? "Observe the mission"}</h3>
                <p>{briefing?.description ?? "Read-only access. Join an open crew seat to receive private information."}</p>
              </section>
              {selected && (
                <section className="lunar-selection">
                  <div className="lunar-section-title"><span>SELECTED LOCATION</span><button onClick={() => setSelected(null)} title="Clear selection" aria-label="Clear selection"><X size={15} /></button></div>
                  <h3>{selected} / {SITES[selected].name}</h3>
                  <p>{selected === state.position ? "Current crew location." : openRoute ? "Route available from the current position." : selected === "C" && state.position === "B" ? "Crater route closed by lunar night." : "No active route from your current position."}</p>
                  {currentRole === "engineer" && selectedRoute && <div className="lunar-cost"><Gauge size={15} /> O₂ −{selectedRoute.oxygen} <Zap size={15} /> ENERGY −{selectedRoute.energy}</div>}
                  {state.status === "active" && (openRoute || selected === "B" && state.position === "B" && !state.repaired) && (
                    mode === "demo"
                      ? <button className="lunar-action" disabled={!!pending} onClick={() => demoAction("propose")}>PROPOSE {proposedDestination === "repair" ? "REPAIR" : `MOVE TO ${selected}`} <ArrowRight size={16} /></button>
                      : currentRole && <button className="lunar-action" onClick={() => copy(`/propose ${proposedDestination}`)}><Clipboard size={16} /> COPY /PROPOSE {proposedDestination?.toUpperCase()}</button>
                  )}
                </section>
              )}
              {pending && (
                <section className="lunar-pending" aria-live="polite">
                  <div className="lunar-section-title"><span>AWAITING CREW CONFIRMATION</span><strong>{Math.ceil((pending.expiresAt - now) / 1000)}s</strong></div>
                  <p>{pending.action.type === "repair" ? "Restore the beacon signal" : `Move to ${SITES[pending.action.destination].name}`}</p>
                  {mode === "demo"
                    ? <button className="lunar-action" onClick={() => demoAction("confirm")}><Check size={16} /> CONFIRM AS {role.toUpperCase()}</button>
                    : currentRole && <button className="lunar-action" onClick={() => copy("/confirm")}><Clipboard size={16} /> COPY /CONFIRM</button>}
                </section>
              )}
              {mode === "live" && (
                <section className="lunar-radio">
                  <div className="lunar-section-title"><span><Radio size={14} /> TELEGRAM RADIO</span><span>{view?.paired ? "PAIRED" : "UNPAIRED"}</span></div>
                  <p>Create a Telegram group with your teammate and add the Photon-powered mission bot.</p>
                  {currentRole && <div className="lunar-command-list">
                    <button onClick={() => copy(`/pair ${view?.pairCode}`)}><span>/pair {view?.pairCode}</span><Clipboard size={15} /></button>
                    <button onClick={() => copy(`/bind ${view?.bindCode}`)}><span>/bind {view?.bindCode}</span><Clipboard size={15} /></button>
                  </div>}
                  <button className="lunar-invite" onClick={() => copy(`${window.location.origin}/?room=${view?.code}`)}><ExternalLink size={15} /> COPY INVITE LINK</button>
                  {!currentRole && !view?.crew.engineer && <button className="lunar-invite" onClick={() => void joinLunarMission({ data: { code: view!.code } }).then((next) => setView(next)).catch((caught) => setError(String(caught)))}>JOIN AS ENGINEER</button>}
                </section>
              )}
              {mode === "demo" && <p className="lunar-demo-note">LOCAL DEMO / Switch roles to confirm actions. Telegram messages are not sent.</p>}
              {state.status !== "active" && mode === "demo" && <button className="lunar-reset" onClick={() => demoAction("restart")}><RotateCcw size={16} /> RESTART MISSION</button>}
              {state.status !== "active" && mode === "live" && currentRole === "navigator" && <button className="lunar-reset" onClick={() => copy("/restart")}><Clipboard size={16} /> COPY /RESTART</button>}
              <section className="lunar-log">
                <div className="lunar-section-title"><span>MISSION LOG</span><span>{String(state.events.length).padStart(2, "0")}</span></div>
                {[...state.events].reverse().slice(0, 5).map((event) => <div key={event.id} className="lunar-log-entry"><span>{String(event.id).padStart(2, "0")}</span><p>{event.text}</p></div>)}
                {!state.events.length && <p className="lunar-log-empty">Waiting for the first decision.</p>}
              </section>
              {error && <p className="lunar-error" role="alert">{error}</p>}
            </div>
          </div>
          <div className="lunar-bottom-caption"><span>SECTOR 07 · LUNAR SOUTH</span><span>DRAG TO ORBIT · SCROLL TO ZOOM</span></div>
        </>
      )}
      {intro && <div className="lunar-intro" aria-live="polite">
        <div className="lunar-intro-index">MISSION 001 · LUNAR RELAY</div>
        <div className="lunar-intro-main" key={introPhase}>
          <p>{introPhase === 0 ? "INCOMING TRANSMISSION" : introPhase === 1 ? "TWO CREW. ONE SIGNAL." : "THE BEACON IS DARK."}</p>
          <strong>{introPhase === 0 ? "LUNAR RELAY" : introPhase === 1 ? "FIND THE WAY" : "BRING THEM HOME"}</strong>
        </div>
        <div className="lunar-intro-bottom"><span>ESTABLISHING SURFACE LINK</span><button onClick={() => { setIntro(false); setIntroPhase(3); }}>SKIP <ArrowRight size={16} /></button></div>
        <div className="lunar-intro-progress"><i /></div>
      </div>}
    </div>
  );
}
