# REX OS

A polished, anime-inspired NAS command-center dashboard. REX OS aggregates your
self-hosted services (Jellyfin, Nextcloud, Immich, Portainer/Docker, qBittorrent,
pyLoad) into one glassmorphism UI with live widgets, direct download management
and per-service health checks.

## Stack

- **Frontend:** Vite · React 19 · React Router v7 (imports from `react-router`)
- **Styling:** Tailwind v4 · custom glassmorphism theme system (CSS variables in
  `src/styles/theme.css` and `src/index.css`) · Lucide icons · Framer Motion
- **Backend:** small Express API in `backend/` (no Convex — the frontend talks
  to `/api/*`, proxied by Vite in dev, served by `server.js` in production)
- **Auth:** Express-side — bcrypt-verified login that sets an httpOnly JWT
  cookie (`backend/routes/auth.js`); credentials never reach the browser
- **Package manager:** `bun`

## Pages / routes

| Route | Page | Source |
| --- | --- | --- |
| `/login` | Sign-in | `src/pages/Login.jsx` |
| `/` | Dashboard (hero, stats, Quick Launch, widgets) | `src/pages/Home.jsx` |
| `/direct-link` | Direct Link Add → pyLoad | `src/pages/DirectLink.jsx` |
| `/media` | Jellyfin media library (search/filter/detail) | `src/pages/Media.jsx` |
| `/cloud` | Nextcloud overview (users, storage, activity) | `src/pages/Cloud.jsx` |
| `/photos` | Immich overview (stats, albums) | `src/pages/Photos.jsx` |
| `/docker` | Container list + start/stop/restart/logs | `src/pages/Docker.jsx` |
| `/system` | NAS health & monitoring | `src/pages/System.jsx` |
| `/settings` | Themes + connection tests | `src/pages/Settings.jsx` |

All app routes are wrapped in `RequireAuth` (`src/components/RequireAuth.jsx`),
which sends signed-out users to `/login?returnTo=<route>` and returns them after
sign-in. Navigation lives in `src/components/Sidebar.jsx` (desktop) and
`src/components/BottomNav.jsx` (mobile).

## Setup

```bash
bun install        # install frontend deps
cd backend && bun install   # install backend deps
```

Run the dev stack (Vite dev server with `/api` proxied to Express on :4000):

```bash
bun dev
```

Or run the backend alone:

```bash
bun backend        # node backend/server.js → http://localhost:4000
```

Production build (typecheck + Vite build → `dist/`):

```bash
bun run build
```

## Backend environment variables (server-side only)

All credentials live in the backend process environment (`backend/.env` or
host env), with an optional gitignored fill-gap override file
`backend/.auth-secrets.json`. They are never placed in `VITE_*` variables and
never sent to the browser.

| Variable | Purpose |
| --- | --- |
| `PORT` | API/UI port (default `4000`) |
| `COOKIE_SECURE` | `true` behind HTTPS so the auth cookie is TLS-only |
| `REX_USERNAME` / `REX_PASSWORD_HASH` / `JWT_SECRET` | Auth: bcrypt-verified login + httpOnly JWT cookie |
| `PORTAINER_URL` / `PORTAINER_API_TOKEN` / `PORTAINER_ENDPOINT_ID` | Docker / Portainer |
| `JELLYFIN_URL` / `JELLYFIN_API_KEY` | Jellyfin media server |
| `NEXTCLOUD_URL` / `NEXTCLOUD_USERNAME` / `NEXTCLOUD_PASSWORD` | Nextcloud OCS |
| `IMMICH_URL` / `IMMICH_API_KEY` | Immich photos |
| `QBITTORRENT_URL` / `QBITTORRENT_USERNAME` / `QBITTORRENT_PASSWORD` | qBittorrent (connection probe) |
| `PYLOAD_URL` / `PYLOAD_USERNAME` / `PYLOAD_PASSWORD` | pyLoad direct-link downloads |

In production, `node server.js` serves both the built UI (`dist/`) and the
`/api` backend from one process — see `DEPLOY.md`.

## API surface (`backend/`)

- `GET /api/health` · `GET /api/system` — telemetry (CPU, RAM, storage, network, temp)
- `GET /api/system/connections` · `POST /api/system/connections/:id/test` — server-side service probes
- `GET /api/docker` (+ `/logs/:id`, `/restart/:id`, `/stop/:id`, `/start/:id`)
- `GET /api/jellyfin` (+ `/users`, `/latest`, `/items`, `/resume`, `/sessions`, `/poster/:id`, `/backdrop/:id`)
- `GET /api/nextcloud/status|info|users|storage|activity`
- `GET /api/immich/overview`
- `GET /api/pyload` · `POST /api/pyload/add` · `GET /api/pyload/status`
- `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`

The Direct Link flow: REX only hands the URL to pyLoad (`add_package`); pyLoad
decides the filename, and the existing pyLoad → Radarr/Sonarr importer handles
everything downstream. REX never renames or classifies downloads.

## Frontend conventions

- Pages live in `src/pages/`, shared components in `src/components/`, data
  fetching in `src/services/` + `src/api/`.
- User-facing service definitions (name, icon, URL) live in `src/data/services.js`;
  the Quick Launch carousel renders that list.
- Use the existing toast service (`src/services/toastService.js`) for
  confirmations and errors.
- Keep everything mobile-responsive; larger dialogs/drawers scroll internally
  and never overflow the viewport.
- New backend integrations should follow the existing
  route → controller → service pattern in `backend/`, reading credentials from
  `process.env` only.

## Checks

```bash
bun tsc -b --noEmit   # typecheck
bun run lint          # eslint
cd backend && node smoke.js   # boots the API in-process and probes every endpoint
```
