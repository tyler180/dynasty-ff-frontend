"use client";

import { useCallback, useEffect, useState } from "react";
import {
  analyzeSnapshot,
  leagueCoordinates,
  type DropCandidate,
  type LiveAnalysis,
  type RookieAssessment,
} from "./api-client";
import { useAuth } from "./auth";

type View = "overview" | "roster" | "draft";
type RookiePool = "offense" | "idp";

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <span>F</span>
      <span>D</span>
    </span>
  );
}

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

export default function Home() {
  const auth = useAuth();
  const [view, setView] = useState<View>("overview");
  const [capTarget, setCapTarget] = useState(10);
  const [analysis, setAnalysis] = useState<LiveAnalysis | null>(null);
  const [rookiePool, setRookiePool] = useState<RookiePool>("offense");
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "current" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("Authenticated API ready");

  const loadAnalysis = useCallback(async (target: number) => {
    setSyncStatus("loading");
    setSyncMessage("Analyzing latest snapshot…");
    try {
      const response = await analyzeSnapshot(auth.authorizedFetch, target);
      if (!response.analysis?.analysis) throw new Error("Analysis response was empty");
      setAnalysis(response.analysis.analysis);
      setSyncMessage(`Observed ${formatTimestamp(response.analysis.snapshot_observed_at)}`);
      setSyncStatus("current");
    } catch (cause) {
      setSyncMessage(cause instanceof Error ? cause.message : "Analysis request failed");
      setSyncStatus("error");
    }
  }, [auth.authorizedFetch]);

  useEffect(() => {
    if (!auth.ready || !auth.user) return;
    const timeout = window.setTimeout(() => void loadAnalysis(10), 0);
    return () => window.clearTimeout(timeout);
  }, [auth.ready, auth.user, loadAnalysis]);

  if (!auth.ready) return <AuthScreen title="Opening Front Office…" />;
  if (!auth.user) {
    return (
      <AuthScreen
        title="Your dynasty decision room."
        message={auth.error ?? "Sign in through Authentik to access league data."}
        actionLabel="Sign in"
        onAction={() => void auth.signIn("/")}
      />
    );
  }
  if (!analysis && syncStatus === "loading") return <AuthScreen title="Loading league analysis…" />;
  if (!analysis && syncStatus === "error") {
    return <AuthScreen title="League analysis unavailable" message={syncMessage} actionLabel="Try again" onAction={() => void loadAnalysis(capTarget)} />;
  }

  const cap = analysis?.cap ?? { used: 0, limit: 0, space: 0 };
  const roster = analysis?.roster ?? {
    active: { used: 0, limit: 0, open: 0 },
    injured_reserve: { used: 0, limit: 0, open: 0 },
    taxi: { used: 0, limit: 0, open: 0 },
  };
  const draft = analysis?.draft ?? { status: "loading", picks: [], pick_count: 0, total_salary_if_all_active: 0 };
  const board = analysis?.rookie_board;
  const selectedBoard = board?.[rookiePool];
  const rookies = selectedBoard?.candidates ?? [];
  const draftPicks = draft.picks;
  const rosterMoves = buildRosterMoves(analysis);
  const priorityMoves = analysis?.drop_evaluation.recommended_cuts ?? [];
  const priorityRosterMoves = priorityMoves.map((candidate) => rosterMove(candidate, "Drop candidate", "red"));
  const recommendedRelief = analysis?.drop_evaluation.recommended_cap_relief ?? 0;
  const projectedSpace = cap.space + recommendedRelief;

  const displayName = auth.user.profile.name || auth.user.profile.preferred_username || auth.user.profile.email || "Signed in";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Front Office home">
          <Mark />
          <span>
            <strong>Front Office</strong>
            <small>Dynasty intelligence</small>
          </span>
        </a>

        <nav className="nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>
            <span className="nav-icon">⌂</span> Overview
          </button>
          <button className={view === "roster" ? "active" : ""} onClick={() => setView("roster")}>
            <span className="nav-icon">◫</span> Roster plan <em>{analysis?.drop_evaluation.drop_candidates?.length ?? 0}</em>
          </button>
          <button className={view === "draft" ? "active" : ""} onClick={() => setView("draft")}>
            <span className="nav-icon">◇</span> Rookie board
          </button>
          <p className="nav-label second">League</p>
          <a href="#capital"><span className="nav-icon">◒</span> Capital</a>
          <a href="#methodology"><span className="nav-icon">∿</span> Methodology</a>
        </nav>

        <div className={`sync-card ${syncStatus === "error" ? "has-error" : ""}`}>
          <span className="signal"><i /></span>
          <div>
            <strong>{syncStatus === "loading" ? "Loading snapshot" : syncStatus === "error" ? "API request failed" : "Data connection"}</strong>
            <small>{syncMessage}</small>
          </div>
          <button disabled={syncStatus === "loading"} onClick={() => void loadAnalysis(capTarget)} aria-label="Refresh league analysis" title="Refresh analysis">↻</button>
        </div>

        <div className="profile">
          <span className="avatar">{initials}</span>
          <span><strong>{displayName}</strong><small>Authenticated</small></span>
          <button onClick={() => void auth.signOut()} aria-label="Sign out" title="Sign out">↪</button>
        </div>
      </aside>

      <main id="top">
        <header className="topbar">
          <button className="mobile-brand" aria-label="Open navigation"><Mark /></button>
          <div className="league-select">
            <span className="league-badge">IP</span>
            <span><small>League</small><strong>{analysis?.league ?? "League"}</strong></span>
            <span aria-hidden="true">⌄</span>
          </div>
          <div className="top-actions">
            <span className="season">{leagueCoordinates.season} season</span>
            <button className="icon-button" aria-label="Notifications">♢<i /></button>
          </div>
        </header>

        <div className="content">
          {view === "overview" && (
            <>
              <section className="hero">
                <div>
                  <p className="eyebrow">{analysis?.team ?? "Team"} · Decision room</p>
                  <h1>Your live board is ready<br />for the next pick.</h1>
                  <p className="hero-copy">Rankings reflect the rookies still available in MFL as of {formatDate(analysis?.snapshot_date)}. Your next selection is {draftPicks[0]?.pick ?? "not currently scheduled"}.</p>
                </div>
                <div className="readiness">
                  <div className="score-ring"><span><strong>{board?.ranked_candidates ?? 0}</strong><small>RANKED</small></span></div>
                  <p><strong>Live availability</strong><span>{board?.unranked_candidates ?? 0} more unranked</span></p>
                </div>
              </section>

              <section className="stat-grid" aria-label="Team summary">
                <article>
                  <div className="stat-heading"><span>Cap space</span><em className="positive">+${formatMoney(cap.space)}</em></div>
                  <strong className="big-stat">${formatMoney(cap.space)}</strong><span className="muted">of ${formatMoney(cap.limit)} available</span>
                  <div className="meter"><i style={{ width: `${cap.limit > 0 ? Math.min(100, (cap.used / cap.limit) * 100) : 0}%` }} /></div>
                  <small>${formatMoney(cap.used)} committed</small>
                </article>
                <article>
                  <div className="stat-heading"><span>Active roster</span><em>{roster.active.open} open</em></div>
                  <strong className="big-stat">{roster.active.used}<span>/{roster.active.limit}</span></strong><span className="muted">players signed</span>
                  <div className="slot-row" aria-label={`${roster.active.used} of ${roster.active.limit} roster slots filled`}>{Array.from({ length: roster.active.limit }, (_, i) => <i className={i < roster.active.used ? "filled" : ""} key={i} />)}</div>
                  <small>{roster.injured_reserve.used} IR · {roster.taxi.open} taxi slots open</small>
                </article>
                <article>
                  <div className="stat-heading"><span>Draft capital</span><em className="accent">{draft.pick_count} picks</em></div>
                  <strong className="big-stat">{draftPicks[0]?.pick ?? "—"}</strong><span className="muted">next selection</span>
                  <div className="pick-line"><i /><i /><i /><i /><i /></div>
                  <small>${formatMoney(draft.total_salary_if_all_active)} total rookie salary</small>
                </article>
              </section>

              <section className="decision-grid">
                <article className="panel action-panel">
                  <div className="panel-title">
                    <div><p className="eyebrow">Priority action</p><h2>Make room without losing value</h2></div>
                    <span className="confidence">High confidence</span>
                  </div>
                  <p className="panel-intro">A two-player move reaches your <strong>${capTarget} relief target</strong> while protecting young and tradeable assets.</p>

                  <div className="move-list">
                    {priorityRosterMoves.map((player, index) => (
                      <div className="move" key={player.name}>
                        <span className="move-number">0{index + 1}</span>
                        <span className="position-badge">{player.meta.slice(0, 2).trim()}</span>
                        <span className="move-player"><strong>{player.name}</strong><small>{player.note}</small></span>
                        <span className="relief"><small>RELIEF</small><strong>+${player.salary}</strong></span>
                      </div>
                    ))}
                  </div>

                  <div className="outcome-strip">
                    <span><small>Combined relief</small><strong>+${formatMoney(recommendedRelief)}</strong></span>
                    <span className="plus">+</span>
                    <span><small>Projected cap space</small><strong>${formatMoney(projectedSpace)}</strong></span>
                    <button onClick={() => setView("roster")}>Review roster plan <ArrowIcon /></button>
                  </div>
                </article>

                <article className="panel draft-panel">
                  <div className="panel-title">
                    <div><p className="eyebrow">On the clock soon</p><h2>Draft outlook</h2></div>
                    <span className="live-dot">{humanize(draft.status)}</span>
                  </div>
                  <div className="draft-picks">
                    {draftPicks.slice(0, 3).map((pick) => (
                      <div key={pick.pick}>
                        <span><strong>{pick.pick}</strong><small>Overall {pick.overall}</small></span>
                        <span><small>ROOKIE SALARY</small><strong>${pick.salary}</strong></span>
                        <em>{pick.fits_active_now ? "Fits now ✓" : "Cap move needed"}</em>
                      </div>
                    ))}
                  </div>
                  <button className="text-link" onClick={() => setView("draft")}>Open rookie board <ArrowIcon /></button>
                </article>
              </section>

              <section className="scenario" id="capital">
                <div>
                  <p className="eyebrow">Scenario planner</p>
                  <h2>How much flexibility do you want?</h2>
                  <p>Adjust the target to test roster moves before draft night.</p>
                </div>
                <div className="slider-wrap">
                  <div className="slider-label"><span>Cap relief target</span><strong>${capTarget}</strong></div>
                  <input aria-label="Cap relief target" type="range" min="0" max="20" step="1" value={capTarget} onChange={(event) => setCapTarget(Number(event.target.value))} style={{ "--fill": `${capTarget * 5}%` } as React.CSSProperties} />
                  <div className="range-labels"><span>$0</span><span>$10</span><span>$20</span></div>
                </div>
              </section>
            </>
          )}

          {view === "roster" && (
            <section className="workspace-view">
              <div className="view-heading"><div><p className="eyebrow">Roster plan</p><h1>Protect value.<br />Create flexibility.</h1></div><span className="summary-pill">${formatMoney(cap.space)} current space</span></div>
              <div className="table-card">
                <div className="table-head"><span>Player</span><span>Salary</span><span>VORP</span><span>Recommendation</span></div>
                {rosterMoves.map((player) => (
                  <div className="table-row" key={player.name}>
                    <span className="player-cell"><i className={`player-dot ${player.tone}`}>{player.name.split(" ").map(part => part[0]).join("")}</i><span><strong>{player.name}</strong><small>{player.meta}</small></span></span>
                    <strong>${player.salary}</strong><span>{player.vorp}</span>
                    <span className="recommendation"><em className={player.tone}>{player.status}</em><small>{player.note}</small></span>
                  </div>
                ))}
                {rosterMoves.length === 0 && <div className="empty-state">No roster recommendations are available for this snapshot.</div>}
              </div>
              <div className="method-note" id="methodology"><strong>How recommendations work</strong><p>Production is compared with real free agents at the same position, then adjusted for age, development, salary, and dynasty market value. Young assets are protected from becoming ordinary cut recommendations.</p></div>
            </section>
          )}

          {view === "draft" && (
            <section className="workspace-view">
              <div className="view-heading"><div><p className="eyebrow">{leagueCoordinates.season} rookie board</p><h1>The available board,<br />right now.</h1></div><span className="summary-pill">{selectedBoard?.ranked_candidates ?? 0} ranked · {selectedBoard?.unranked_candidates ?? 0} unranked</span></div>
              <div className="board-switch" aria-label="Rookie board group">
                <button className={rookiePool === "offense" ? "active" : ""} onClick={() => setRookiePool("offense")}>Offense <span>{board?.offense.candidates.length ?? 0}</span></button>
                <button className={rookiePool === "idp" ? "active" : ""} onClick={() => setRookiePool("idp")}>IDP <span>{board?.idp.candidates.length ?? 0}</span></button>
              </div>
              <div className="board-layout">
                <div className="table-card board-card">
                  <div className="table-head"><span>Rank</span><span>Available prospect</span><span>Rookie ADP</span><span>Status</span></div>
                  {rookies.map((rookie) => (
                    <div className="table-row" key={rookie.player_id}>
                      <strong className="rank">{rookie.rank ? String(rookie.rank).padStart(2, "0") : "—"}</strong>
                      <span className="player-cell"><i className="player-dot green">{initialsFor(rookie.name)}</i><span><strong>{rookie.name}</strong><small>{rookie.position} · {rookie.nfl_team || "FA"}</small></span></span>
                      <span>{formatADP(rookie)}</span><em className={rookie.rank && rookie.rank <= 3 ? "fit top" : "fit"}>{rookie.valued ? "Ranked" : "Unranked"}</em>
                    </div>
                  ))}
                  {rookies.length === 0 && <div className="empty-state">No available rookies were returned for this board.</div>}
                </div>
                <aside className="pick-stack">
                  <p className="eyebrow">Your remaining picks</p><h2>{draft.pick_count} selections</h2>
                  {draftPicks.map((pick) => <div key={pick.pick}><strong>{pick.pick}</strong><span>Overall {pick.overall}</span><em>${formatMoney(pick.salary)}</em></div>)}
                  <p className="small-note">Total salary if all remaining picks stay active: <strong>${formatMoney(draft.total_salary_if_all_active)}</strong>.</p>
                </aside>
              </div>
              {board?.caution && <div className="method-note rookie-caution"><strong>Board methodology</strong><p>{board.caution}</p></div>}
            </section>
          )}

          <footer><span>Front Office · {leagueCoordinates.season}</span><span>Read-only league intelligence</span><span>Model snapshot · {formatDate(analysis?.snapshot_date)}</span></footer>
        </div>
      </main>
    </div>
  );
}

function AuthScreen({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <span className="auth-mark">FD</span>
        <p className="eyebrow">Front Office</p>
        <h1>{title}</h1>
        {message && <p>{message}</p>}
        {actionLabel && onAction && <button onClick={onAction}>{actionLabel} <ArrowIcon /></button>}
      </div>
    </main>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

type RosterMove = {
  name: string;
  meta: string;
  salary: number;
  vorp: string;
  status: string;
  note: string;
  tone: string;
};

function buildRosterMoves(analysis: LiveAnalysis | null): RosterMove[] {
  if (!analysis?.drop_evaluation.available) return [];
  return [
    ...(analysis.drop_evaluation.drop_candidates ?? []).map((candidate) => rosterMove(candidate, "Drop candidate", "red")),
    ...(analysis.drop_evaluation.trade_first ?? []).map((candidate) => rosterMove(candidate, "Trade first", "blue")),
    ...(analysis.drop_evaluation.hold_develop ?? []).map((candidate) => rosterMove(candidate, "Hold / develop", "amber")),
  ];
}

function rosterMove(candidate: DropCandidate, status: string, tone: string): RosterMove {
  const vorp = candidate.dynasty_adjusted_vorp ?? candidate.value_over_replacement;
  return {
    name: candidate.name,
    meta: `${candidate.position} · age ${candidate.age || "—"}`,
    salary: candidate.salary_cap_relief,
    vorp: vorp === undefined ? "—" : formatSigned(vorp),
    status,
    note: candidate.disposition_reason || "Model recommendation",
    tone,
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatDate(value?: string): string {
  if (!value) return "pending";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatADP(rookie: RookieAssessment): string {
  return rookie.rookie_adp ? rookie.rookie_adp.toFixed(2) : "—";
}

function initialsFor(name: string): string {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}
