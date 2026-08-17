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
