# Dynasty FF

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
https://dynasty-ff.k8s.749rmw.com/auth/callback
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

In production it runs in the Talos cluster at https://dynasty-ff.k8s.749rmw.com (LAN only), deployed by Argo CD from `applications/dynasty-ff` in `tyler180/talos-gitops`. Every push to `main` publishes `ghcr.io/tyler180/dynasty-ff-frontend:sha-<commit>`; release it by bumping the pinned digest there.

## Current boundary

The UI renders the live analysis of the latest MFL snapshot through the
authenticated HTTP API, and can request a fresh snapshot. It is read-only: no
commissioner mutations belong in this frontend.

## Validation

```sh
npm run build
npm run lint
```
