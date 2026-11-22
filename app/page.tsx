"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth";
import {
  analyzeSnapshot,
  defensiveFreeAgentTrends,
  type TrendFilters,
  type TrendPositionGroup,
  leagueCoordinates,
  syncSnapshot,
  waitForNewSnapshot,
  type DefensiveTrend,
  type DefensiveTrendsResponse,
  type DropCandidate,
  type LiveAnalysis,
  type RookieAssessment,
  type RookieBoardPool,
  type SyncMode,
} from "./api-client";
import { pfrGamelogUrl } from "./pfr";

type View = "overview" | "roster" | "free-agents" | "draft";
type RookiePool = "overall" | "offense" | "idp";
type SyncStatus = "idle" | "loading" | "syncing" | "current" | "error";
type TrendsState =
  | { status: "idle" | "loading" }
  | { status: "ready"; data: NonNullable<DefensiveTrendsResponse["defensive_free_agent_trends"]> }
  | { status: "error"; message: string };

// Team management comes first. The rookie board appears only after a draft-day refresh.
const teamViews: Array<{ id: View; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "roster", label: "Cut / keep" },
  { id: "free-agents", label: "Free agents" },
];
const draftView: { id: View; label: string } = { id: "draft", label: "Rookie board" };

// Age filters for the free-agent view; 0 is no filter.
const ageFilters = [
  { value: 26, label: "Under 26" },
  { value: 28, label: "Under 28" },
  { value: 0, label: "Any age" },
];

// Position filters for the free-agent view; undefined is every group.
const positionFilters: Array<{ value?: TrendPositionGroup; label: string }> = [
  { label: "All" },
  { value: "DL", label: "DL" },
  { value: "LB", label: "LB" },
  { value: "DB", label: "DB" },
];

// Wait for the slider to settle before asking the model for a new plan.
const capTargetDebounceMilliseconds = 450;

export default function Home() {
  const auth = useAuth();
  const [view, setView] = useState<View>("overview");
  const [capTarget, setCapTarget] = useState(10);
  const [analysis, setAnalysis] = useState<LiveAnalysis | null>(null);
  const [snapshotObservedAt, setSnapshotObservedAt] = useState<string>();
  const [rookiePool, setRookiePool] = useState<RookiePool>("overall");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [draftMode, setDraftMode] = useState(false);
  const [trendFilters, setTrendFilters] = useState<TrendFilters>({ maxAge: 28 });
  const [trends, setTrends] = useState<TrendsState>({ status: "idle" });
  const latestRequest = useRef(0);
  const latestTrendsRequest = useRef(0);
  const hasRequested = useRef(false);
  // The snapshot sync reads the target when it finishes, not when it started.
  const latestCapTarget = useRef(capTarget);
  // Likewise the open tab and free-agent filters, which can change while a sync runs.
  const latestView = useRef(view);
  const latestTrendFilters = useRef(trendFilters);
  useEffect(() => {
    latestCapTarget.current = capTarget;
    latestView.current = view;
    latestTrendFilters.current = trendFilters;
  }, [capTarget, view, trendFilters]);

  const loadAnalysis = useCallback(async (target: number) => {
    // Ignore responses that arrive after a newer request was made.
    const requestId = ++latestRequest.current;
    setSyncStatus("loading");
    setSyncMessage("Analyzing…");
    try {
      const response = await analyzeSnapshot(auth.authorizedFetch, target);
      if (requestId !== latestRequest.current) return;
      if (!response.analysis?.analysis) throw new Error("Analysis response was empty");
      setAnalysis(response.analysis.analysis);
      setSnapshotObservedAt(response.analysis.snapshot_observed_at);
      setSyncMessage("");
      setSyncStatus("current");
    } catch (cause) {
      if (requestId !== latestRequest.current) return;
      setSyncMessage(cause instanceof Error ? cause.message : "Analysis request failed");
      setSyncStatus("error");
    }
  }, [auth.authorizedFetch]);

  const loadTrends = useCallback(async (filters: TrendFilters) => {
    const requestId = ++latestTrendsRequest.current;
    setTrends({ status: "loading" });
    try {
      const response = await defensiveFreeAgentTrends(auth.authorizedFetch, filters);
      if (requestId !== latestTrendsRequest.current) return;
      if (!response.defensive_free_agent_trends) throw new Error("Free-agent trend response was empty");
      setTrends({ status: "ready", data: response.defensive_free_agent_trends });
    } catch (cause) {
      if (requestId !== latestTrendsRequest.current) return;
      setTrends({ status: "error", message: cause instanceof Error ? cause.message : "Free-agent trend request failed" });
    }
  }, [auth.authorizedFetch]);

  const createFreshSnapshot = useCallback(async (mode: SyncMode) => {
    setSyncStatus("syncing");
    setSyncMessage(mode === "draft" ? "Fetching live draft data…" : "Refreshing from MFL…");
    try {
      await syncSnapshot(auth.authorizedFetch, mode);
      setSyncMessage("Waiting for the new snapshot…");
      await waitForNewSnapshot(auth.authorizedFetch, snapshotObservedAt);
      await loadAnalysis(latestCapTarget.current);
      if (mode === "draft") {
        setDraftMode(true);
        setView("draft");
      } else if (latestView.current === "free-agents") {
        void loadTrends(latestTrendFilters.current);
      } else {
        // Free agents change with the snapshot; reload them the next time the tab opens.
        setTrends({ status: "idle" });
      }
    } catch (cause) {
      setSyncMessage(cause instanceof Error ? cause.message : "Snapshot sync failed");
      setSyncStatus("error");
    }
  }, [auth.authorizedFetch, loadAnalysis, loadTrends, snapshotObservedAt]);

  // Load on sign-in, then re-run whenever the cap relief target settles.
  useEffect(() => {
    if (!auth.ready || !auth.user) return;
    const delay = hasRequested.current ? capTargetDebounceMilliseconds : 0;
    hasRequested.current = true;
    const timeout = window.setTimeout(() => void loadAnalysis(capTarget), delay);
    return () => window.clearTimeout(timeout);
  }, [auth.ready, auth.user, capTarget, loadAnalysis]);

  // Load free-agent trends the first time the tab opens and after each refresh.
  const selectView = (next: View) => {
    setView(next);
    if (next === "free-agents" && trends.status === "idle") void loadTrends(trendFilters);
  };

  const changeTrendFilters = (change: Partial<TrendFilters>) => {
    const next = { ...trendFilters, ...change };
    setTrendFilters(next);
    void loadTrends(next);
  };

  if (!auth.ready) return <AuthScreen title="Opening Dynasty FF…" />;
  if (!auth.user) {
    return (
      <AuthScreen
        title="Sign in to Dynasty FF."
        message={auth.error ?? "League data is private. Sign in through Authentik to continue."}
        actionLabel="Sign in"
        onAction={() => void auth.signIn("/")}
      />
    );
  }
  if (!analysis && syncStatus === "error") {
    return <AuthScreen title="League analysis unavailable" message={syncMessage} actionLabel="Try again" onAction={() => void loadAnalysis(capTarget)} />;
  }
  if (!analysis) return <AuthScreen title="Loading league analysis…" />;

  const cap = analysis.cap;
  const roster = analysis.roster;
  const draft = analysis.draft;
  const board = analysis.rookie_board;
  const draftPicks = draft.picks ?? [];
  const busy = syncStatus === "loading" || syncStatus === "syncing";
  const displayName = auth.user.profile.name || auth.user.profile.preferred_username || auth.user.profile.email || "Signed in";

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead-title">
          <p className="wordmark">Dynasty FF</p>
          <h1>{analysis.team}</h1>
          <p className="masthead-meta">
            {analysis.league} · {leagueCoordinates.season} season · snapshot {snapshotObservedAt ? formatTimestamp(snapshotObservedAt) : formatDate(analysis.snapshot_date)}
          </p>
        </div>
        <div className="masthead-actions">
          <span className={`status ${syncStatus}`} role="status" aria-live="polite">{syncMessage}</span>
          <button className="quiet-button" disabled={busy} onClick={() => void loadAnalysis(capTarget)} title="Reanalyze the current snapshot">Reanalyze</button>
          <button className="quiet-button" disabled={busy} onClick={() => void createFreshSnapshot("draft")} title="Quick refresh with live draft picks and rookie ADP">Draft day</button>
          <button className="button" disabled={busy} onClick={() => void createFreshSnapshot("team")} title="Pull fresh roster, cap and free-agent data from MFL">Refresh</button>
          <button className="quiet-button" onClick={() => void auth.signOut()} title={`Signed in as ${displayName}`}>Sign out</button>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        {(draftMode ? [...teamViews, draftView] : teamViews).map((item) => (
          <button key={item.id} className={view === item.id ? "tab active" : "tab"} aria-current={view === item.id ? "page" : undefined} onClick={() => selectView(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {view === "overview" && (
          <>
            <section className="ledger" aria-label="Team summary">
              <LedgerRow label="Cap space">
                <span className="figure">${formatMoney(cap.space)}</span>
                <span className="figure-note">free of ${formatMoney(cap.limit)} · ${formatMoney(cap.used)} committed</span>
                <span className="bar" aria-hidden="true"><i style={{ width: `${percent(cap.used, cap.limit)}%` }} /></span>
              </LedgerRow>
              <LedgerRow label="Roster">
                <span className="figure">{roster.active.used}<span className="figure-of">/{roster.active.limit}</span></span>
                <span className="figure-note">active · IR {roster.injured_reserve.used}/{roster.injured_reserve.limit} · taxi {roster.taxi.used}/{roster.taxi.limit}</span>
              </LedgerRow>
              <LedgerRow label="Draft">
                <span className="figure">{draftPicks[0]?.pick ?? "—"}</span>
                <span className="figure-note">
                  {draftPicks.length > 0 ? `next pick · ${draft.pick_count} remaining · $${formatMoney(draft.total_salary_if_all_active)} if all kept active` : `no picks remaining · ${humanize(draft.status)}`}
                </span>
              </LedgerRow>
            </section>

            <RecommendedMoves analysis={analysis} capTarget={capTarget} onCapTargetChange={setCapTarget} busy={syncStatus === "loading"} locked={syncStatus === "syncing"} />

            {analysis.warnings.length > 0 && (
              <section className="section">
                <SectionHeading title="Data warnings" />
                <ul className="warnings">{analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </section>
            )}
          </>
        )}

        {view === "roster" && <RosterPlan analysis={analysis} />}

        {view === "free-agents" && (
          <FreeAgents state={trends} filters={trendFilters} onFiltersChange={changeTrendFilters} onRetry={() => void loadTrends(trendFilters)} />
        )}

        {view === "draft" && (
          <RookieBoard
            board={board}
            pool={rookiePool}
            onPoolChange={setRookiePool}
            picks={draftPicks}
            pickCount={draft.pick_count}
            totalSalary={draft.total_salary_if_all_active}
          />
        )}
      </main>

      <footer className="colophon">
        <span>Dynasty FF · read-only team management</span>
        <span>Model snapshot {formatDate(analysis.snapshot_date)}</span>
      </footer>
    </div>
  );
}

function LedgerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ledger-row">
      <span className="ledger-label">{label}</span>
      <span className="ledger-value">{children}</span>
    </div>
  );
}

function SectionHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {children && <div className="section-tools">{children}</div>}
    </div>
  );
}

function RecommendedMoves({
  analysis,
  capTarget,
  onCapTargetChange,
  busy,
  locked,
}: {
  analysis: LiveAnalysis;
  capTarget: number;
  onCapTargetChange: (value: number) => void;
  busy: boolean;
  locked: boolean;
}) {
  const evaluation = analysis.drop_evaluation;
  const cuts = evaluation.recommended_cuts ?? [];
  const relief = evaluation.recommended_cap_relief ?? 0;

  return (
    <section className={busy ? "section is-updating" : "section"}>
      <SectionHeading title="Recommended moves">
        <label className="target">
          <span>Cap relief target</span>
          <input type="range" min="0" max="20" step="1" value={capTarget} disabled={locked} title={locked ? "Locked while a new snapshot is fetched" : undefined} onChange={(event) => onCapTargetChange(Number(event.target.value))} />
          <strong className="target-value">${capTarget}</strong>
        </label>
      </SectionHeading>

      {!evaluation.available && <p className="empty">Roster recommendations aren&apos;t available for this snapshot.</p>}
      {evaluation.available && cuts.length === 0 && (
        <p className="empty">{capTarget === 0 ? "No relief target set, so no moves are recommended." : `No drops are needed or available to free $${capTarget}.`}</p>
      )}
      {cuts.length > 0 && (
        <table className="table">
          <thead>
            <tr><th scope="col">Move</th><th scope="col">Player</th><th scope="col" className="num">Relief</th><th scope="col" className="wide">Why</th></tr>
          </thead>
          <tbody>
            {cuts.map((candidate) => (
              <tr key={candidate.player_id}>
                <td className="tag drop">Drop</td>
                <td><PlayerName candidate={candidate} /></td>
                <td className="num">+${formatMoney(candidate.salary_cap_relief)}</td>
                <td className="wide reason">{candidate.disposition_reason || "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>{cuts.length === 1 ? "1 move" : `${cuts.length} moves`}</td>
              <td className="num">+${formatMoney(relief)}</td>
              <td className="wide">${formatMoney(analysis.cap.space + relief)} free afterwards</td>
            </tr>
          </tfoot>
        </table>
      )}
      {evaluation.caution && <p className="note">{evaluation.caution}</p>}
    </section>
  );
}

function RosterPlan({ analysis }: { analysis: LiveAnalysis }) {
  const evaluation = analysis.drop_evaluation;
  const groups: Array<{ title: string; tone: string; label: string; candidates: DropCandidate[] }> = [
    { title: "Drop candidates", tone: "drop", label: "Drop", candidates: evaluation.drop_candidates ?? [] },
    { title: "Trade first", tone: "trade", label: "Trade", candidates: evaluation.trade_first ?? [] },
    { title: "Hold and develop", tone: "hold", label: "Hold", candidates: evaluation.hold_develop ?? [] },
  ];

  return (
    <>
      {!evaluation.available && <p className="empty">Roster recommendations aren&apos;t available for this snapshot.</p>}
      {evaluation.available && groups.map((group) => (
        <section className="section" key={group.title}>
          <SectionHeading title={group.title}><span className="count">{group.candidates.length}</span></SectionHeading>
          {group.candidates.length === 0 ? (
            <p className="empty">None.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th scope="col">Player</th><th scope="col" className="num">Salary</th><th scope="col" className="num">VORP</th><th scope="col" className="wide">Why</th></tr>
              </thead>
              <tbody>
                {group.candidates.map((candidate) => (
                  <tr key={candidate.player_id}>
                    <td><PlayerName candidate={candidate} /></td>
                    <td className="num">${formatMoney(candidate.salary_cap_relief)}</td>
                    <td className="num">{formatVORP(candidate)}</td>
                    <td className="wide reason">{candidate.disposition_reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
      <p className="note">
        Production is compared with real free agents at the same position, then adjusted for age, development, salary and dynasty market value. VORP is value over that replacement.
      </p>
    </>
  );
}

function RookieBoard({
  board,
  pool,
  onPoolChange,
  picks,
  pickCount,
  totalSalary,
}: {
  board: LiveAnalysis["rookie_board"];
  pool: RookiePool;
  onPoolChange: (pool: RookiePool) => void;
  picks: NonNullable<LiveAnalysis["draft"]["picks"]>;
  pickCount: number;
  totalSalary: number;
}) {
  const rookiePool = pool;
  const selectedBoard = rookiePool === "overall" ? buildOverallRookieBoard(board) : board[rookiePool];
  const rookies = selectedBoard?.candidates ?? [];

  return (
    <div className="board-layout">
      <section className="section">
        <SectionHeading title="Rookie board">
          <div className="segmented" role="group" aria-label="Rookie board group">
            <button className={rookiePool === "overall" ? "active" : ""} aria-pressed={rookiePool === "overall"} onClick={() => onPoolChange("overall")}>Overall</button>
            <button className={rookiePool === "offense" ? "active" : ""} aria-pressed={rookiePool === "offense"} onClick={() => onPoolChange("offense")}>Offense</button>
            <button className={rookiePool === "idp" ? "active" : ""} aria-pressed={rookiePool === "idp"} onClick={() => onPoolChange("idp")}>IDP</button>
          </div>
        </SectionHeading>
        <p className="section-meta">
          {selectedBoard?.ranked_candidates ?? 0} ranked · {selectedBoard?.unranked_candidates ?? 0} unranked · still available in MFL
        </p>
        {rookies.length === 0 ? (
          <p className="empty">No available rookies were returned for this board.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th scope="col" className="num rank">#</th><th scope="col">Prospect</th><th scope="col" className="num">Rookie ADP</th></tr>
            </thead>
            <tbody>
              {rookies.map((rookie) => (
                <tr key={rookie.player_id} className={rookie.valued ? "" : "unranked"}>
                  <td className="num rank">{rookie.rank ?? "—"}</td>
                  <td>
                    <span className="player">{rookie.name}</span>
                    <span className="player-meta">{rookie.position} · {rookie.nfl_team || "FA"}</span>
                  </td>
                  <td className="num">{formatADP(rookie)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="note">
          {rookiePool === "overall"
            ? "Overall combines every available rookie, ordered by MFL rookie-only ADP. Offense and IDP use their own blended rankings."
            : board.caution}
        </p>
      </section>

      <aside className="section picks" aria-label="Your remaining picks">
        <SectionHeading title="Your picks"><span className="count">{pickCount}</span></SectionHeading>
        {picks.length === 0 ? (
          <p className="empty">No picks remaining.</p>
        ) : (
          <table className="table compact">
            <tbody>
              {picks.map((pick) => (
                <tr key={pick.pick}>
                  <td className="pick">{pick.pick}</td>
                  <td><span className="player-meta">overall {pick.overall}</span></td>
                  <td className="num">${formatMoney(pick.salary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="note">${formatMoney(totalSalary)} in salary if every remaining pick stays active.</p>
      </aside>
    </div>
  );
}

function FreeAgents({
  state,
  filters,
  onFiltersChange,
  onRetry,
}: {
  state: TrendsState;
  filters: TrendFilters;
  onFiltersChange: (change: Partial<TrendFilters>) => void;
  onRetry: () => void;
}) {
  const data = state.status === "ready" ? state.data : undefined;
  const rising = (data?.trends ?? []).filter((trend) => trend.signal === "rising");
  const latest = rising.find((trend) => trend.latest_week);

  return (
    <section className={state.status === "loading" ? "section is-updating" : "section"}>
      <SectionHeading title="Rising defenders">
        <div className="section-tools filter-tools">
          <div className="segmented" role="group" aria-label="Position filter">
            {positionFilters.map((filter) => {
              const active = filters.positionGroup === filter.value;
              return (
                <button key={filter.label} className={active ? "active" : ""} aria-pressed={active} onClick={() => onFiltersChange({ positionGroup: filter.value })}>
                  {filter.label}
                </button>
              );
            })}
          </div>
          <div className="segmented" role="group" aria-label="Age filter">
            {ageFilters.map((filter) => (
              <button key={filter.value} className={filters.maxAge === filter.value ? "active" : ""} aria-pressed={filters.maxAge === filter.value} onClick={() => onFiltersChange({ maxAge: filter.value })}>
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </SectionHeading>
      <p className="section-meta">
        {data
          ? `Available defensive free agents whose snap share rose over their last ${data.config.recent_games} games · ${data.available_defensive_players} free agents checked${latest ? ` · through ${latest.latest_season} week ${latest.latest_week}` : ""}`
          : "Available defensive free agents whose snap share is rising"}
      </p>

      {state.status === "error" && (
        <p className="empty">{state.message} <button className="quiet-button" onClick={onRetry}>Try again</button></p>
      )}
      {(state.status === "idle" || (state.status === "loading" && !data)) && <p className="empty">Loading free agents…</p>}
      {data && rising.length === 0 && <p className="empty">No available {filters.positionGroup ? `${filters.positionGroup}s` : "defenders"} are trending up right now.</p>}
      {rising.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col" className="num">Snap share</th>
              <th scope="col" className="num">Change</th>
              <th scope="col" className="num wide">Confirmed</th>
              <th scope="col" className="wide">Recent games</th>
            </tr>
          </thead>
          <tbody>
            {rising.map((trend) => (
              <tr key={trend.player_id}>
                <td>
                  <TrendPlayerName trend={trend} />
                  <span className="player-meta">{trend.position || trend.position_group.toUpperCase()} · {trend.age === null ? "age unknown" : `age ${trend.age}`}</span>
                </td>
                <td className="num">{sharePercent(trend.baseline.defense_snap_share)} → {sharePercent(trend.recent.defense_snap_share)}</td>
                <td className="num">+{Math.round(trend.change_percentage_points)} pts</td>
                <td className="num wide">{trend.confirming_games} of {trend.recent.games}</td>
                <td className="wide"><Sparkline trend={trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="note">
        Compares each player&apos;s share of team defensive snaps in his last three games with the three before, which can reach back into last season. A rise counts when it is at least 10 points and at least two of the recent games confirm it.
      </p>
    </section>
  );
}

// Weekly defensive snap share for the last eight games, oldest first.
function Sparkline({ trend }: { trend: DefensiveTrend }) {
  const games = trend.weekly.slice(-8);
  if (games.length < 2) return <span className="player-meta">—</span>;
  const width = 96;
  const height = 24;
  const step = width / (games.length - 1);
  const points = games.map((game, index) => `${(index * step).toFixed(1)},${(height - game.defense_snap_share * height).toFixed(1)}`).join(" ");
  const label = games.map((game) => `${game.season} week ${game.week}: ${sharePercent(game.defense_snap_share)}`).join(", ");
  return (
    <svg className="sparkline" viewBox={`-2 -2 ${width + 4} ${height + 4}`} width={width + 4} height={height + 4} role="img" aria-label={label}>
      <title>{label}</title>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Links the name to the player's PFR game log for his latest season; without
// a usable ID or season it stays plain text.
function TrendPlayerName({ trend }: { trend: DefensiveTrend }) {
  const href = pfrGamelogUrl(trend.pfr_player_id, trend.latest_season);
  if (!href) return <span className="player">{trend.name}</span>;
  return (
    <a className="player player-link" href={href} target="_blank" rel="noopener noreferrer"
      title={`${trend.name}'s ${trend.latest_season} game log on Pro Football Reference (opens in a new tab)`}>
      {trend.name}
    </a>
  );
}

function sharePercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function PlayerName({ candidate }: { candidate: DropCandidate }) {
  return (
    <>
      <span className="player">{candidate.name}</span>
      <span className="player-meta">{candidate.position} · {candidate.age ? `age ${candidate.age}` : "age unknown"}</span>
    </>
  );
}

function buildOverallRookieBoard(board: LiveAnalysis["rookie_board"] | undefined): RookieBoardPool | undefined {
  if (!board) return undefined;
  const candidates = [
    ...(board.offense.candidates ?? []),
    ...(board.idp.candidates ?? []),
    ...(board.other?.candidates ?? []),
  ].map((candidate): RookieAssessment => ({ ...candidate, rank: undefined, valued: Boolean(candidate.rookie_adp && candidate.rookie_adp > 0) }));

  candidates.sort((left, right) => {
    const leftADP = left.rookie_adp && left.rookie_adp > 0 ? left.rookie_adp : Number.POSITIVE_INFINITY;
    const rightADP = right.rookie_adp && right.rookie_adp > 0 ? right.rookie_adp : Number.POSITIVE_INFINITY;
    return leftADP - rightADP || left.name.localeCompare(right.name);
  });
  let rank = 0;
  for (const candidate of candidates) {
    if (candidate.valued) candidate.rank = ++rank;
  }
  return {
    available: rank > 0,
    source: "MFL rookie-only ADP",
    ranked_candidates: rank,
    unranked_candidates: candidates.length - rank,
    candidates,
  };
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
        <p className="wordmark">Dynasty FF</p>
        <h1>{title}</h1>
        {message && <p>{message}</p>}
        {actionLabel && onAction && <button className="button" onClick={onAction}>{actionLabel}</button>}
      </div>
    </main>
  );
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatVORP(candidate: DropCandidate): string {
  const value = candidate.dynasty_adjusted_vorp ?? candidate.value_over_replacement;
  if (value === undefined) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
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

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}
