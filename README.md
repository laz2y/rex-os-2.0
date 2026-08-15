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
| `/docker` | Docker Manager 2.0 — search/filter/sort, live stats, logs | `src/pages/Docker.jsx` |
| `/system` | Real-time NAS monitoring (CPU/RAM/swap/network/disk I/O/procs) | `src/pages/System.jsx` |
| `/storage` | Storage dashboard — filesystems, thresholds, disk I/O | `src/pages/Storage.jsx` |
| `/search` | Global search across media, downloads, Docker, pages | `src/pages/Search.jsx` |
| `/updates` | Update Manager — upload, validate, rollback point, install | `src/pages/Updates.jsx` |
| `/backups` | Backups — manual/automatic REX state snapshots + restore | `src/pages/Backups.jsx` |
| `/recovery` | Auto-recovery monitor + update rollback points | `src/pages/Recovery.jsx` |
| `/settings` | Themes, connections, notification preferences | `src/pages/Settings.jsx` |

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
| `PYLOAD_URL` / `PYLOAD_USERNAME` / `PYLOAD_PASSWORD` | pyLoad direct-link downloads. When rex-backend runs as a container, use the Docker service name — `http://pyload:8000` — and make sure the `pyload` container is attached to the same Docker network as rex-backend (see `DEPLOY.md` → Docker networking). When not on Docker, use the reverse-proxy base URL instead (e.g. `https://pyload.laz2ynas.cc`) |

In production, `node server.js` serves both the built UI (`dist/`) and the
`/api` backend from one process — see `DEPLOY.md`.

## API surface (`backend/`)

- `GET /api/health` · `GET /api/system` — telemetry (CPU, RAM, storage, network, temp)
- `GET /api/system/connections` · `POST /api/system/connections/:id/test` — server-side service probes
- `GET /api/docker` (+ `/logs/:id`, `/restart/:id`, `/stop/:id`, `/start/:id`)
- `GET /api/jellyfin` (+ `/users`, `/latest`, `/items`, `/resume`, `/sessions`, `/poster/:id`, `/backdrop/:id`)
- `GET /api/nextcloud/status|info|users|storage|activity`
- `GET /api/immich/overview`
- `GET /api/pyload` · `POST /api/pyload/add` · `GET /api/pyload/status` · `POST /api/pyload/remove`
- `GET /api/qbittorrent` · `POST /api/qbittorrent/add|pause|resume|remove`
- `GET /api/radarr/overview` · `GET /api/sonarr/overview` — Media Center ARR sections
- `GET /api/search?q=` — global search (media, downloads, Docker, activity, pages)
- `GET /api/pipeline` · `POST /api/pipeline/restart/:service` · `POST /api/pipeline/restart-group` · `GET /api/pipeline/recovery`
- `GET /api/diagnostics` · `GET /api/activity` · `GET /api/notifications`
- `GET /api/system/metrics` · `GET /api/storage` · `/api/terminal/*` — session-authenticated
- `GET|POST /api/update/*` · `GET|POST|DELETE /api/backups` — session-authenticated
- `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`

The Direct Link flow: REX only hands the URL to pyLoad (`add_package`); pyLoad
decides the filename, and the existing pyLoad → Radarr/Sonarr importer handles
everything downstream. REX never renames or classifies downloads.

## REX OS 3.0 additions

- **System Monitoring** — `/api/system/metrics` (cached 4s) feeds the System
  page: CPU deltas from `/proc/stat`, memory/swap, per-interface network
  throughput, disk I/O, top processes, thermal zones and a Docker overview.
- **Docker Manager 2.0** — search, status filters, sorting, live per-container
  CPU/RAM/network/block-I/O stats and curated inspect (env vars are never
  exposed) on top of the existing Portainer abstraction.
- **Storage Dashboard** — filesystem inventory with `REX_STORAGE_WARN` /
  `REX_STORAGE_CRIT` thresholds, shared with Diagnostics and Auto-Recovery.
- **Media Center** — Jellyfin plus Radarr/Sonarr overviews (library, missing,
  queue, recent activity).
- **Unified Downloads** — one page with qBittorrent and pyLoad tabs.
- **Global Search** — debounced `/api/search` with 15s server-side caching.
- **Push notifications (fallback)** — browser Notification API while REX OS
  is open; per-category toggles in Settings. No external push provider needed.
- **Update Manager** — upload → validate (safe archive, manifest, semver) →
  rollback point → install (stage + syntax-check + verify) with history and
  rollback. The running API cannot restart its own container; installs are
  staged and the container is recreated on the NAS to activate (see
  `rex-updater/DESIGN.md`).
- **Backups** — manual + automatic (daily) REX state snapshots with restore;
  never includes media or secrets.
- **Recovery** — auto-recovery monitor status plus update rollback points.

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
