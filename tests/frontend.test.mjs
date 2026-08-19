import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps the dashboard product-specific", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  assert.match(page, /Front Office/);
  assert.match(page, /Roster plan/);
  assert.match(page, /Rookie board/);
  assert.match(page, /Cap relief target/);
  assert.match(layout, /Dynasty Intelligence/);
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
  assert.match(page, /New snapshot/);
  assert.match(page, /syncSnapshot/);
  assert.doesNotMatch(page, /Jordyn Tyson|Makai Lemon|KC Concepcion/);
  assert.match(client, /analysis:\s*LiveAnalysis/);
});
