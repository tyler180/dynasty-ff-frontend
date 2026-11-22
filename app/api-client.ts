const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://5y8s0du210.execute-api.us-west-2.amazonaws.com"
).replace(/\/$/, "");

export const leagueCoordinates = {
  season: Number(process.env.NEXT_PUBLIC_LEAGUE_SEASON ?? "2026"),
  leagueId: process.env.NEXT_PUBLIC_LEAGUE_ID ?? "79286",
  franchiseId: process.env.NEXT_PUBLIC_FRANCHISE_ID ?? "0005",
};

export type AuthorizedFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type SnapshotResponse = {
  action: "latest_snapshot" | "snapshot_at";
  status: "ok";
  snapshot?: {
    observed_at?: string;
    [key: string]: unknown;
  };
};

export type SnapshotSyncResponse = {
  action: "start_mfl_sync";
  status: "accepted";
};

export type RookieAssessment = {
  rank?: number;
  valued: boolean;
  player_id: string;
  name: string;
  position: string;
  nfl_team?: string;
  rookie_adp?: number;
};

export type RookieBoardPool = {
  available: boolean;
  source?: string;
  ranked_candidates: number;
  unranked_candidates: number;
  candidates: RookieAssessment[] | null;
};

export type DropCandidate = {
  player_id: string;
  name: string;
  position: string;
  age: number;
  salary_cap_relief: number;
  dynasty_adjusted_vorp?: number;
  value_over_replacement?: number;
  disposition: string;
  disposition_reason: string;
};

export type LiveAnalysis = {
  snapshot_date: string;
  league: string;
  team: string;
  cap: { used: number; limit: number; space: number };
  roster: {
    active: { used: number; limit: number; open: number };
    injured_reserve: { used: number; limit: number; open: number };
    taxi: { used: number; limit: number; open: number };
  };
  draft: {
    status: string;
    picks: Array<{
      pick: string;
      overall: number;
      salary: number;
      fits_active_now: boolean;
      fits_taxi_now: boolean;
    }> | null;
    pick_count: number;
    total_salary_if_all_active: number;
  };
  drop_evaluation: {
    available: boolean;
    recommended_cuts?: DropCandidate[];
    recommended_cap_relief?: number;
    drop_candidates?: DropCandidate[];
    trade_first?: DropCandidate[];
    hold_develop?: DropCandidate[];
    caution: string;
  };
  rookie_board: {
    available: boolean;
    source?: string;
    ranked_candidates: number;
    unranked_candidates: number;
    offense: RookieBoardPool;
    idp: RookieBoardPool;
    other?: RookieBoardPool;
    caution: string;
  };
  warnings: string[];
};

export type UsageWindow = {
  games: number;
  defense_snaps: number;
  team_defense_snaps: number;
  defense_snap_share: number;
};

export type WeeklyUsage = {
  game_id: string;
  season: number;
  week: number;
  defense_snap_share: number;
};

export type DefensiveTrend = {
  player_id: string;
  name: string;
  // Pro Football Reference player ID; absent when no snap fact carries one.
  pfr_player_id?: string;
  position?: string;
  position_group: string;
  age: number | null;
  signal: "rising" | "falling" | "stable" | "volatile" | "insufficient_data";
  confidence: string;
  baseline: UsageWindow;
  recent: UsageWindow;
  change_percentage_points: number;
  confirming_games: number;
  latest_season?: number;
  latest_week?: number;
  weekly: WeeklyUsage[];
  reason: string;
};

export type DefensiveTrendsResponse = {
  action: "top_defensive_free_agent_trends";
  status: "ok";
  defensive_free_agent_trends?: {
    league_season: number;
    snap_seasons: number[];
    available_defensive_players: number;
    players_with_snap_data: number;
    excluded_by_age: number;
    config: { recent_games: number; minimum_confirming_games: number; max_age?: number };
    trends: DefensiveTrend[] | null;
  };
};

// maxAge keeps players younger than it; 0 means no age filter.
export async function defensiveFreeAgentTrends(
  fetcher: AuthorizedFetch,
  maxAge: number,
): Promise<DefensiveTrendsResponse> {
  const query = new URLSearchParams({
    season: String(leagueCoordinates.season),
    league_id: leagueCoordinates.leagueId,
    limit: "25",
  });
  if (maxAge > 0) query.set("max_age", String(maxAge));
  return request<DefensiveTrendsResponse>(fetcher, `/v1/free-agents/defensive-trends?${query}`);
}

export type AnalysisResponse = {
  action: "analyze";
  status: "ok";
  analysis?: {
    snapshot_observed_at: string;
    projection_fallback: string;
    analysis: LiveAnalysis;
  };
};

export async function latestSnapshot(fetcher: AuthorizedFetch): Promise<SnapshotResponse> {
  const query = new URLSearchParams({
    season: String(leagueCoordinates.season),
    league_id: leagueCoordinates.leagueId,
    franchise_id: leagueCoordinates.franchiseId,
  });
  return request<SnapshotResponse>(fetcher, `/v1/snapshots/latest?${query}`);
}

// "team" is the full refresh (roster, cap, free agents, FantasyPros values).
// "draft" is the quick draft-day refresh with live picks and rookie ADP.
export type SyncMode = "team" | "draft";

export async function syncSnapshot(fetcher: AuthorizedFetch, mode: SyncMode): Promise<SnapshotSyncResponse> {
  return request<SnapshotSyncResponse>(fetcher, "/v1/snapshots/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      season: leagueCoordinates.season,
      league_id: leagueCoordinates.leagueId,
      franchise_id: leagueCoordinates.franchiseId,
      mode,
    }),
  });
}

// A team refresh runs for up to five minutes in the worker; wait a little longer.
export async function waitForNewSnapshot(
  fetcher: AuthorizedFetch,
  previousObservedAt: string | undefined,
  timeoutMilliseconds = 330_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await latestSnapshot(fetcher);
      const observedAt = response.snapshot?.observed_at;
      if (observedAt && observedAt !== previousObservedAt) return observedAt;
    } catch (cause) {
      lastError = cause;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("The snapshot is still running. Try refreshing the analysis in a moment.");
}

export async function analyzeSnapshot(
  fetcher: AuthorizedFetch,
  capReliefTarget: number,
): Promise<AnalysisResponse> {
  return request<AnalysisResponse>(fetcher, "/v1/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      season: leagueCoordinates.season,
      league_id: leagueCoordinates.leagueId,
      franchise_id: leagueCoordinates.franchiseId,
      cap_relief_target: capReliefTarget,
      projection_fallback: "auto",
    }),
  });
}

async function request<T>(
  fetcher: AuthorizedFetch,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetcher(`${apiBaseUrl}${path}`, init);
  const body = (await response.json().catch(() => null)) as
    | T
    | { message?: string; error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? body.message
        : undefined;
    throw new Error(message || `API request failed (${response.status})`);
  }
  return body as T;
}
