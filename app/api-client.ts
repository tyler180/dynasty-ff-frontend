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

export type AnalysisResponse = {
  action: "analyze";
  status: "ok";
  analysis?: unknown;
};

export async function latestSnapshot(fetcher: AuthorizedFetch): Promise<SnapshotResponse> {
  const query = new URLSearchParams({
    season: String(leagueCoordinates.season),
    league_id: leagueCoordinates.leagueId,
    franchise_id: leagueCoordinates.franchiseId,
  });
  return request<SnapshotResponse>(fetcher, `/v1/snapshots/latest?${query}`);
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
