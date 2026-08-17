# Front Office

The frontend for the dynasty-football analysis platform. The first slice presents Team McLean's verified 2026 league snapshot as a decision dashboard with an interactive cap scenario, replacement-aware roster plan, and rookie board.

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:3000`.

## Self-hosting

Build and run the production container:

```sh
docker compose up --build -d
```

The app listens on port `3000` and exposes `GET /api/health` for container and Kubernetes probes. The image uses Next.js standalone output and runs as an unprivileged user.

## Current boundary

The UI currently uses a representative snapshot derived from the backend's `analyze` response. The next integration step is to expose that Lambda action through an authenticated HTTP endpoint and replace the local view model with a typed read-only client. No commissioner mutations belong in this frontend.

## Validation

```sh
npm run build
npm run lint
```
