import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps the dashboard product-specific", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  assert.match(page, /Dynasty FF/);
  assert.match(page, /Cut \/ keep/);
  assert.match(page, /Free agents/);
  assert.match(page, /Rookie board/);
  assert.match(page, /Draft day/);
  assert.match(page, /Cap relief target/);
  assert.match(layout, /Dynasty FF/);
  assert.doesNotMatch(page + layout, /Front Office/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview/);
});

test("is configured for portable self-hosting", async () => {
  const [config, dockerfile, compose] = await Promise.all([
    readFile(new URL("next.config.ts", root), "utf8"),
    readFile(new URL("Dockerfile", root), "utf8"),
    readFile(new URL("compose.yaml", root), "utf8"),
  ]);

  assert.match(config, /output:\s*["']standalone["']/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(compose, /3000:3000/);
  await assert.rejects(access(new URL(".openai/hosting.json", root)));
});

test("uses Authentik PKCE and an authenticated API client", async () => {
  const [auth, callback, metadata, client, compose] = await Promise.all([
    readFile(new URL("app/auth.tsx", root), "utf8"),
    readFile(new URL("app/auth/callback/page.tsx", root), "utf8"),
    readFile(new URL("app/api/oidc-metadata/route.ts", root), "utf8"),
    readFile(new URL("app/api-client.ts", root), "utf8"),
    readFile(new URL("compose.yaml", root), "utf8"),
  ]);

  assert.match(auth, /response_type:\s*["']code["']/);
  assert.match(auth, /Bearer \$\{currentUser\.access_token\}/);
  assert.doesNotMatch(auth + client + compose, /client_secret/i);
  assert.match(callback, /completeSignIn/);
  assert.match(auth, /signinRedirectCallback/);
  assert.match(auth, /\/api\/oidc-metadata/);
  assert.match(metadata, /\.well-known\/openid-configuration/);
  assert.match(client, /\/v1\/snapshots\/latest/);
  assert.match(client, /\/v1\/analyze/);
  assert.match(client, /\/v1\/snapshots\/sync/);
  assert.match(client, /\/v1\/free-agents\/defensive-trends/);
  assert.match(compose, /NEXT_PUBLIC_API_BASE_URL/);
});

test("renders the live analysis instead of the original rookie mock", async () => {
  const [page, client] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api-client.ts", root), "utf8"),
  ]);

  assert.match(page, /analyzeSnapshot/);
  assert.match(page, /rookie_board/);
  assert.match(page, /rookiePool === ["']offense["']/);
  assert.match(page, /rookiePool === ["']idp["']/);
  assert.match(page, /rookiePool === ["']overall["']/);
  assert.match(page, /Refresh/);
  assert.match(page, /syncSnapshot/);
  assert.match(page, /waitForNewSnapshot/);
  assert.match(page, /draft\.picks \?\? \[\]/);
  assert.match(page, /board\.offense\.candidates \?\? \[\]/);
  assert.doesNotMatch(page, /Jordyn Tyson|Makai Lemon|KC Concepcion/);
  assert.match(client, /analysis:\s*LiveAnalysis/);
});

// app/pfr.ts has no imports, so it can be transpiled and loaded directly
// without relying on Node's TypeScript support.
async function loadPfr() {
  const { default: ts } = await import("typescript");
  const source = await readFile(new URL("app/pfr.ts", root), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("builds Pro Football Reference game-log links for the latest season", async () => {
  const { pfrGamelogUrl } = await loadPfr();
  const base = "https://www.pro-football-reference.com/players";
  const cases = [
    ["BoetBr00", 2026, `${base}/B/BoetBr00/gamelog/2026/`],
    ["Ya-SRo00", 2026, `${base}/Y/Ya-SRo00/gamelog/2026/`],
    ["MasoR01", 2025, `${base}/M/MasoR01/gamelog/2025/`],
    ["vandJo00", 2026, `${base}/V/vandJo00/gamelog/2026/`],
    ["  WilsMa01 ", 2026, `${base}/W/WilsMa01/gamelog/2026/`],
  ];
  for (const [id, season, want] of cases) {
    assert.equal(pfrGamelogUrl(id, season), want, `${id} ${season}`);
  }
  const rejected = [
    [undefined, 2026], ["", 2026], ["Boet/Br00", 2026], ["javascript:alert(1)", 2026],
    ["Boet Br00", 2026], ["BoetBr", 2026], ["BoetBr00", undefined], ["BoetBr00", 2026.5], ["BoetBr00", 1900],
  ];
  for (const [id, season] of rejected) {
    assert.equal(pfrGamelogUrl(id, season), undefined, `${id} ${season} should not link`);
  }
});

test("links free-agent names to their PFR game log in a new tab", async () => {
  const [page, client] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api-client.ts", root), "utf8"),
  ]);
  assert.match(client, /pfr_player_id\?: string/);
  assert.match(page, /pfrGamelogUrl\(trend\.pfr_player_id, trend\.latest_season\)/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /<TrendPlayerName trend=\{trend\} \/>/);
});
