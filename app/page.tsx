"use client";

import { useMemo, useState } from "react";

type View = "overview" | "roster" | "draft";

const draftPicks = [
  { pick: "1.06", salary: 15, tier: "Impact" },
  { pick: "1.07", salary: 15, tier: "Impact" },
  { pick: "2.06", salary: 7, tier: "Starter" },
  { pick: "3.01", salary: 3, tier: "Depth" },
  { pick: "3.06", salary: 3, tier: "Depth" },
];

const rookies = [
  { rank: 1, name: "Jordyn Tyson", meta: "WR · NO", adp: "4.20", fit: "Primary target" },
  { rank: 2, name: "Makai Lemon", meta: "WR · PHI", adp: "4.71", fit: "Primary target" },
  { rank: 3, name: "KC Concepcion", meta: "WR · CLE", adp: "7.35", fit: "Value at 1.07" },
  { rank: 4, name: "Fernando Mendoza", meta: "QB · LV", adp: "7.78", fit: "Value at 1.07" },
  { rank: 5, name: "Kenyon Sadiq", meta: "TE · NYJ", adp: "8.41", fit: "Watch list" },
];

const rosterMoves = [
  {
    name: "Derrick Barnes",
    meta: "LB · age 27",
    salary: 4,
    vorp: "−5.02",
    status: "Drop candidate",
    note: "Below the current LB replacement level",
    tone: "red",
  },
  {
    name: "Bradley Chubb",
    meta: "DE · age 30",
    salary: 6,
    vorp: "−0.47",
    status: "Drop candidate",
    note: "Replaceable production at a higher salary",
    tone: "red",
  },
  {
    name: "Adonai Mitchell",
    meta: "WR · age 23",
    salary: 11,
    vorp: "—",
    status: "Develop",
    note: "Early-career protection overrides efficiency",
    tone: "amber",
  },
  {
    name: "Saquon Barkley",
    meta: "RB · age 29",
    salary: 39,
    vorp: "+4.91",
    status: "Trade first",
    note: "Market value is greater than cap relief",
    tone: "blue",
  },
];

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
  const [view, setView] = useState<View>("overview");
  const [capTarget, setCapTarget] = useState(10);
  const [refreshed, setRefreshed] = useState(false);

  const projectedSpace = useMemo(() => 21 + Math.min(capTarget, 10), [capTarget]);

  function refreshSnapshot() {
    setRefreshed(true);
    window.setTimeout(() => setRefreshed(false), 2200);
  }

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
            <span className="nav-icon">◫</span> Roster plan <em>2</em>
          </button>
          <button className={view === "draft" ? "active" : ""} onClick={() => setView("draft")}>
            <span className="nav-icon">◇</span> Rookie board
          </button>
          <p className="nav-label second">League</p>
          <a href="#capital"><span className="nav-icon">◒</span> Capital</a>
          <a href="#methodology"><span className="nav-icon">∿</span> Methodology</a>
        </nav>

        <div className="sync-card">
          <span className="signal"><i /></span>
          <div>
            <strong>{refreshed ? "Snapshot refreshed" : "Data is current"}</strong>
            <small>{refreshed ? "Just now" : "Aug 16 · 4:54 PM"}</small>
          </div>
          <button onClick={refreshSnapshot} aria-label="Refresh league snapshot" title="Refresh snapshot">↻</button>
        </div>

        <div className="profile">
          <span className="avatar">TM</span>
          <span><strong>Tyler McLean</strong><small>Commissioner</small></span>
          <button aria-label="Open profile menu">•••</button>
        </div>
      </aside>

      <main id="top">
        <header className="topbar">
          <button className="mobile-brand" aria-label="Open navigation"><Mark /></button>
          <div className="league-select">
            <span className="league-badge">IP</span>
            <span><small>League</small><strong>I Paid What For Who?</strong></span>
            <span aria-hidden="true">⌄</span>
          </div>
          <div className="top-actions">
            <span className="season">2026 season</span>
            <button className="icon-button" aria-label="Notifications">♢<i /></button>
          </div>
        </header>

        <div className="content">
          {view === "overview" && (
            <>
              <section className="hero">
                <div>
                  <p className="eyebrow">Team McLean · Decision room</p>
                  <h1>Your roster is ready<br />for the draft.</h1>
                  <p className="hero-copy">You can sign both first-round picks today. Two low-cost moves create a cleaner path through the rest of the board.</p>
                </div>
                <div className="readiness">
                  <div className="score-ring"><span><strong>92</strong><small>READY</small></span></div>
                  <p><strong>Strong position</strong><span>Cap and roster compliant</span></p>
                </div>
              </section>

              <section className="stat-grid" aria-label="Team summary">
                <article>
                  <div className="stat-heading"><span>Cap space</span><em className="positive">+$21</em></div>
                  <strong className="big-stat">$21</strong><span className="muted">of $250 available</span>
                  <div className="meter"><i style={{ width: "91.6%" }} /></div>
                  <small>$229 committed</small>
                </article>
                <article>
                  <div className="stat-heading"><span>Active roster</span><em>7 open</em></div>
                  <strong className="big-stat">20<span>/27</span></strong><span className="muted">players signed</span>
                  <div className="slot-row" aria-label="20 of 27 roster slots filled">{Array.from({ length: 27 }, (_, i) => <i className={i < 20 ? "filled" : ""} key={i} />)}</div>
                  <small>Plus 2 IR · 1 taxi slot open</small>
                </article>
                <article>
                  <div className="stat-heading"><span>Draft capital</span><em className="accent">11 picks</em></div>
                  <strong className="big-stat">1.06</strong><span className="muted">next selection</span>
                  <div className="pick-line"><i /><i /><i /><i /><i /></div>
                  <small>Two picks in round one</small>
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
                    {rosterMoves.slice(0, 2).map((player, index) => (
                      <div className="move" key={player.name}>
                        <span className="move-number">0{index + 1}</span>
                        <span className="position-badge">{player.meta.slice(0, 2).trim()}</span>
                        <span className="move-player"><strong>{player.name}</strong><small>{player.note}</small></span>
                        <span className="relief"><small>RELIEF</small><strong>+${player.salary}</strong></span>
                      </div>
                    ))}
                  </div>

                  <div className="outcome-strip">
                    <span><small>Combined relief</small><strong>+$10</strong></span>
                    <span className="plus">+</span>
                    <span><small>Projected cap space</small><strong>${projectedSpace}</strong></span>
                    <button onClick={() => setView("roster")}>Review roster plan <ArrowIcon /></button>
                  </div>
                </article>

                <article className="panel draft-panel">
                  <div className="panel-title">
                    <div><p className="eyebrow">On the clock soon</p><h2>Draft outlook</h2></div>
                    <span className="live-dot">In progress</span>
                  </div>
                  <div className="draft-picks">
                    {draftPicks.slice(0, 3).map((pick) => (
                      <div key={pick.pick}>
                        <span><strong>{pick.pick}</strong><small>{pick.tier} tier</small></span>
                        <span><small>ROOKIE SALARY</small><strong>${pick.salary}</strong></span>
                        <em>Fits now ✓</em>
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
              <div className="view-heading"><div><p className="eyebrow">Roster plan</p><h1>Protect value.<br />Create flexibility.</h1></div><span className="summary-pill">$21 current space</span></div>
              <div className="table-card">
                <div className="table-head"><span>Player</span><span>Salary</span><span>VORP</span><span>Recommendation</span></div>
                {rosterMoves.map((player) => (
                  <div className="table-row" key={player.name}>
                    <span className="player-cell"><i className={`player-dot ${player.tone}`}>{player.name.split(" ").map(part => part[0]).join("")}</i><span><strong>{player.name}</strong><small>{player.meta}</small></span></span>
                    <strong>${player.salary}</strong><span>{player.vorp}</span>
                    <span className="recommendation"><em className={player.tone}>{player.status}</em><small>{player.note}</small></span>
                  </div>
                ))}
              </div>
              <div className="method-note" id="methodology"><strong>How recommendations work</strong><p>Production is compared with real free agents at the same position, then adjusted for age, development, salary, and dynasty market value. Young assets are protected from becoming ordinary cut recommendations.</p></div>
            </section>
          )}

          {view === "draft" && (
            <section className="workspace-view">
              <div className="view-heading"><div><p className="eyebrow">2026 rookie board</p><h1>The board,<br />through your lens.</h1></div><span className="summary-pill">69 ranked · 66 unranked</span></div>
              <div className="board-layout">
                <div className="table-card board-card">
                  <div className="table-head"><span>Rank</span><span>Prospect</span><span>Rookie ADP</span><span>Team fit</span></div>
                  {rookies.map((rookie) => (
                    <div className="table-row" key={rookie.name}>
                      <strong className="rank">{String(rookie.rank).padStart(2, "0")}</strong>
                      <span className="player-cell"><i className="player-dot green">{rookie.name.split(" ").map(part => part[0]).join("")}</i><span><strong>{rookie.name}</strong><small>{rookie.meta}</small></span></span>
                      <span>{rookie.adp}</span><em className={rookie.rank < 3 ? "fit top" : "fit"}>{rookie.fit}</em>
                    </div>
                  ))}
                </div>
                <aside className="pick-stack">
                  <p className="eyebrow">Your picks</p><h2>11 selections</h2>
                  {draftPicks.map((pick) => <div key={pick.pick}><strong>{pick.pick}</strong><span>{pick.tier}</span><em>${pick.salary}</em></div>)}
                  <p className="small-note">All current selections fit the active roster. Total salary if all picks remain active: <strong>$51</strong>.</p>
                </aside>
              </div>
            </section>
          )}

          <footer><span>Front Office · 2026</span><span>Read-only league intelligence</span><span>Model snapshot · Aug 16</span></footer>
        </div>
      </main>
    </div>
  );
}
