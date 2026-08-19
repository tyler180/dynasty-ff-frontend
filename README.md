# Front Office

The frontend for the dynasty-football analysis platform. The first slice presents Team McLean's verified 2026 league snapshot as a decision dashboard with an interactive cap scenario, replacement-aware roster plan, and rookie board.

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:3000`.

Copy `.env.example` to `.env.local` to override the Authentik issuer, public
client ID, API Gateway URL, or league coordinates. The Authentik provider must
allow these redirect URIs:

```text
http://localhost:3000/auth/callback
https://dynasty-ff.749rmw.com/auth/callback
```

The browser uses Authorization Code with PKCE. It does not use or contain a
client secret. Access tokens are attached only to requests made to the
configured API Gateway URL. The app serves a same-origin discovery proxy at
`/api/oidc-metadata` because Authentik's discovery document does not include
browser CORS headers; token exchange still happens directly between the browser
and Authentik.

## Self-hosting

Build and run the production container:

```sh
docker compose up --build -d
```

The app listens on port `3000` and exposes `GET /api/health` for container and Kubernetes probes. The image uses Next.js standalone output and runs as an unprivileged user.

## Current boundary

The UI currently presents a representative analysis view while its refresh
control reads the latest real snapshot through the authenticated HTTP API. The
typed client also exposes the analysis request for the next live-data rendering
slice. No commissioner mutations belong in this frontend.

## Validation

```sh
npm run build
npm run lint
```
