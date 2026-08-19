import { NextResponse } from "next/server";

const issuer =
  process.env.NEXT_PUBLIC_OIDC_ISSUER ??
  "https://auth.k8s.749rmw.com/application/o/dynasty-ff/";

export async function GET() {
  const discoveryUrl = new URL(".well-known/openid-configuration", ensureTrailingSlash(issuer));
  try {
    const response = await fetch(discoveryUrl, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json(
        { error: "oidc_discovery_failed" },
        { status: 502, headers: { "cache-control": "no-store" } },
      );
    }
    return NextResponse.json(await response.json(), {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "oidc_discovery_unavailable" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
