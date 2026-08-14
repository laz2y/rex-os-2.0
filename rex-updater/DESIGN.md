# REX Updater — Architecture Design (v0.1)

> Status: **proposal — awaiting approval**
> Phase: **0 (design only)**. No production system is touched by anything in this
> document or the accompanying skeleton. This is a standalone project.

---

## 1. Overview

REX Updater is a **separate, self-hosted Docker container** whose only job is to make
REX OS upgrades safe and repeatable. It receives a signed-style release archive
(`rexos-3.0-release.tar.gz`), validates it, snapshots the current production
container, performs the upgrade transactionally, health-checks the result, and
rolls back automatically on any failure.

Three hard rules:

1. **REX OS production (`rex-backend`, `rex-backend:rexos-2.2`, port 4000) is never
   modified, restarted, or upgraded by this project** — until an explicit, separate
   approval for the integration phase.
2. **The browser never touches Docker.** Only REX Updater talks to the Docker Engine.
   REX OS (later) proxies a controlled API to the updater.
3. **No cloud, no external DB, no public SaaS.** Everything runs on the NAS on a
   private LAN/VPN Docker network.

### Architecture

```
Browser
   │  HTTPS (LAN/VPN)
   ▼
REX OS  (rex-backend :4000 — session auth, serves UI + proxies /api/updater/*)
   │  internal Docker network, shared token (server-side only)
   ▼
REX Updater  (rex-updater :4300 — explicit, fixed operations only)
   │  /var/run/docker.sock (documented, isolated, minimal privilege)
   ▼
Docker Engine
   ├── rex-backend          ← target container (managed lifecycle)
   └── rex-updater-data     ← persistent volume (uploads, state, logs, rollback)
```

Key points:

- **REX OS is the frontend.** The updater has no public website. In the standalone
  phases it ships a minimal dev UI (token-protected) used only for testing.
- **Only the updater holds Docker access.** REX OS's existing Docker page keeps
  using Portainer — unchanged.
- The updater is **resilient even if REX OS is down**, because it does not depend
  on REX OS or Portainer for its own operation (crash recovery requirement).

---

## 2. Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Language/runtime | Node.js 22 LTS, plain CommonJS | Matches the existing `backend/` conventions; zero build step |
| HTTP | Express | Same as REX OS backend; boring and known |
| Docker Engine API | `dockerode` | Direct Engine access; inspect/build/run/remove with full control |
| Archive | `node-tar` (streaming) | Safe extraction flags (`preservePaths:false`), entry filtering |
| Manifest validation | `zod` | Strict schema, forward-compatible `passthrough` for unknown fields |
| Versioning | Hand-rolled `semver.js` (~40 lines) | MAJOR.MINOR.PATCH only; no dependency needed |
| Persistence | JSON state files (atomic write + fsync) | No database — a small state file is sufficient and crash-safe |
| Tests | `node:test` (unit/integration) + shell E2E | No heavy framework needed |

Explicitly **not** used: a database, message queues, Kubernetes, an external auth
provider, or any cloud service. Package manager: `npm` (matches the backend).

---

## 3. Repository layout

`rex-updater/` lives in this workspace as a **fully self-contained directory**
(own `package.json`, no imports from REX OS), so it can be lifted into its own git
repo later without changes.

```
rex-updater/
├── DESIGN.md                  ← this document
├── README.md                  ← run/test instructions
├── Dockerfile                 ← non-root, read-only rootfs, tini
├── docker-compose.yml         ← updater deployment (socket + data volume)
├── package.json
├── .env.example               ← all configurable env vars
├── src/
│   ├── server.js              ← entry: express app, auth middleware, mount routes
│   ├── config.js              ← env parsing + path constants (all configurable)
│   ├── middleware/
│   │   └── auth.js            ← bearer-token auth for every route except /api/health
│   ├── routes/
│   │   ├── update.js          ← upload / validate / plan / upgrade / rollback / status / logs
│   │   └── admin.js           ← history / recovery / audit tail
│   ├── controllers/
│   │   ├── updateController.js
│   │   └── adminController.js
│   ├── services/
│   │   ├── packageService.js  ← upload, sanitize, safe-extract, structure check
│   │   ├── manifestService.js ← zod schema + validation
│   │   ├── versionService.js  ← semver parse/compare + downgrade gating
│   │   ├── diskService.js     ← free-space checks (data volume + Docker storage)
│   │   ├── dockerService.js   ← dockerode wrapper (inspect/snapshot/run/remove/tag)
│   │   ├── stateService.js    ← persistent state file, atomic writes, recovery hints
│   │   ├── lockService.js     ← single-upgrade lock (in-process + on-disk)
│   │   ├── upgradeService.js  ← state machine + orchestration (the core)
│   │   ├── rollbackService.js ← rollback point create/restore
│   │   ├── healthService.js   ← extensible health/functional check registry
│   │   ├── logService.js      ← ring buffer + per-attempt log files + redaction
│   │   └── historyService.js  ← update history records
│   └── lib/
│       ├── semver.js          ← parse/compare, strict MAJOR.MINOR.PATCH
│       ├── safeTar.js         ← traversal-safe extraction wrapper
│       └── redact.js          ← secret masking applied to every log line
├── data/                      ← persistent volume mount point (/data in container)
│   ├── uploads/               ← raw uploaded archives
│   ├── releases/              ← safely extracted release trees
│   ├── state/                 ← update.json, lock.json, history.json
│   ├── logs/                  ← updater.log, audit.log, upgrade-<id>.log
│   └── rollback/              ← rollback points (container snapshot + metadata)
└── test/
    ├── unit/                  ← semver, safeTar, manifest, redact, state, lock
    ├── integration/           ← full flows against a mock Docker Engine API
    ├── fixtures/              ← sample release generator (build-release.mjs)
    └── e2e/                   ← stub REX OS image + real-Docker upgrade rehearsal
```

All data paths derive from one `DATA_DIR` env var (default `/data`) plus subdir
names, so storage layout is fully configurable.

---

## 4. Runtime components

| Component | Responsibility |
| --- | --- |
| `server.js` | Express app; binds updater port (default 4300); mounts routes; token auth |
| `upgradeService` | Orchestrator: walks the state machine, calls each service, records state **before** each step so a crash can be recovered |
| `packageService` | Receives uploads, sanitizes filenames, streaming-safe extraction |
| `manifestService` | Validates `manifest.json` against the schema |
| `versionService` | Semver gating: downgrade block, minimumVersion eligibility |
| `dockerService` | Engine wrapper: `inspect`, `create`, `start`, `stop`, `remove`, `tag`, `systemDf` |
| `rollbackService` | Captures a faithful container snapshot; restores it on demand |
| `healthService` | Runs the health-check registry (HTTP + Docker); expandable |
| `stateService` | Reads/writes `/data/state/update.json` atomically; boot-time recovery detection |
| `lockService` | Single-flight guarantee |
| `logService` | Ring buffer + per-attempt logs; every line passes through `redact()` |
| `historyService` | Persistent update history |

---

## 5. API endpoints (controlled surface only)

Everything except `GET /api/health` requires `Authorization: Bearer <token>`.
There is **no** `/execute`, no free-form Docker command, no shell input.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Updater liveness + current state + installed version |
| `POST` | `/api/update/upload` | Multipart `.tar.gz` (field `package`), size-limited, sanitized |
| `GET` | `/api/update/package` | Info about the uploaded package (manifest preview + validation summary) |
| `POST` | `/api/update/validate` | Full dry-run validation (structure, manifest, version, disk, Docker) — applies nothing |
| `GET` | `/api/update/plan` | **"Show exactly what will happen"**: computed steps, checks, downtime estimate |
| `POST` | `/api/update/upgrade` | Begin the upgrade (`{ allowDowngrade?: false }`) |
| `POST` | `/api/update/cancel` | Abort at a safe point (only pre-rollback-point phases) |
| `POST` | `/api/update/rollback` | Manual rollback to the last rollback point |
| `GET` | `/api/update/status` | Full state snapshot (state, attemptId, versions, steps, lastError) |
| `GET` | `/api/update/logs?attemptId=&after=` | Tail of the upgrade log |
| `GET` | `/api/update/history` | Past upgrade records |
| `GET` | `/api/update/recovery` | When `needs_recovery`: what happened + allowed resolutions |
| `POST` | `/api/update/recovery/resolve` | Explicit operator choice: `resume-check` or `rollback` |

The REX OS integration (Phase 6) maps these to REX-style routes: REX OS validates
its own session cookie, then server-side proxies to the updater, injecting the
shared token. The browser never sees updater credentials.

---

## 6. Docker architecture

### Container

```yaml
# docker-compose.yml (updater only — rex-backend is untouched)
services:
  rex-updater:
    build: .
    image: rex-updater:latest
    container_name: rex-updater
    restart: unless-stopped
    read_only: true
    tmpfs:
      - /tmp
    cap_drop: [ALL]
    security_opt: [no-new-privileges: true]
    user: "10001:10001"                    # non-root 'updater' user
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock   # see justification below
      - rex-updater-data:/data
    environment:
      UPDATER_API_TOKEN: ${UPDATER_API_TOKEN}
      TARGET_CONTAINER: rex-backend
      TARGET_IMAGE_PREFIX: rex-backend
      DATA_DIR: /data
    networks:
      - rex-updater-net
    # NO published ports: reachable only on the internal network by rex-backend.
    # For standalone testing on the NAS, publish to 127.0.0.1:4300 instead.
networks:
  rex-updater-net:
    external: true
volumes:
  rex-updater-data:
```

### Why the Docker socket is mounted

Managing the `rex-backend` container lifecycle (inspect → stop → run new →
health-check → restore old) requires the Docker Engine API. The updater is the
**only** component with this access, and mitigations are layered:

- The socket is reached only by the updater process **inside** its container.
- The updater port is **not published** to the host/LAN; REX OS proxies through the
  internal network.
- The API surface is fixed and explicit — no arbitrary container/exec operations.
- The container runs non-root, read-only rootfs, no-new-privileges, all caps
  dropped; it is not privileged and gets no host PID/network.
- Alternative supported: `DOCKER_HOST` env (e.g. TCP+TLS engine) instead of the
  socket, for users who prefer not to mount it.

### Networks

`rex-updater` and `rex-backend` share an internal bridge (`rex-updater-net`).
The updater reaches REX OS health checks via `http://rex-backend:4000/...`.
Attaching `rex-backend` to this network is a **REX OS-side change deferred to
Phase 6** (with approval) — the updater is fully testable before that using stub
containers on a test network.

---

## 7. Persistent state

Single JSON state file, written atomically (`write → rename → fsync`):

```jsonc
// /data/state/update.json
{
  "state": "idle",              // see state machine
  "attemptId": null,            // uuid per upgrade attempt
  "installedVersion": "2.2.0",  // last verified via /api/health
  "targetVersion": null,
  "uploadedPackage": null,
  "rollbackPointId": null,
  "steps": [],                  // completed step names (for resume/recovery)
  "lastError": null,
  "updatedAt": 0
}
```

Secondary files: `lock.json` (upgrade lock), `history.json` (past upgrades),
rollback point dirs, per-attempt log files.

---

## 8. Update state machine

```
                 ┌──────────────┐
                 │    idle      │◄──────────────────────┐
                 └──────┬───────┘                       │
                        │ upload                        │
                 ┌──────▼───────┐              ┌────────┴────────┐
                 │  uploading   │              │  rolled_back    │
                 └──────┬───────┘              └────────▲────────┘
                        │                              │ rollback ok
                 ┌──────▼───────┐              ┌────────┴────────┐
                 │   uploaded   │              │  rolling_back   │
                 └──────┬───────┘              └────────▲────────┘
                        │ validate                     │ any failure
                 ┌──────▼───────┐              ┌────────┴────────┐
                 │  validating  │              │    failed       │
                 └──────┬───────┘              └────────▲────────┘
                        │ valid                        │ fatal / crash
                 ┌──────▼───────┐              ┌────────┴────────┐
                 │  validated   │              │ needs_recovery  │◄── boot with
                 └──────┬───────┘              └─────────────────┘    in-flight state
                        │ upgrade
                 ┌──────▼───────┐
                 │  preparing   │   (plan + disk + docker preflight)
                 └──────┬───────┘
                 ┌──────▼───────┐
                 │  backing_up  │   ← rollback point created here
                 └──────┬───────┘
                 ┌──────▼───────┐
                 │  installing  │   (stop old → build/tag new image → start new)
                 └──────┬───────┘
                 ┌──────▼───────┐
                 │   starting   │
                 └──────┬───────┘
                 ┌──────▼───────┐
                 │ health_check │   (registry: /api/health + /api/pipeline …)
                 └──────┬───────┘
                 ┌──────▼───────┐
                 │   success    │
                 └──────────────┘
```

- Every transition is recorded in `update.json` **before** the side effect runs, so
  a crash always leaves enough information to recover.
- **Upgrade lock:** one upgrade at a time. `lockService` combines an in-process
  promise-chain mutex with an on-disk lock file. A second `upgrade` while active →
  `409 { "error": "An upgrade is already in progress." }`.

---

## 9. Package format & validation

Accepted: `rexos-3.0-release.tar.gz` (filename pattern
`^rexos-\d+\.\d+\.\d+(-[a-z0-9]+)?-release\.tar\.gz$`).

Expected contents (top level):

```
rexos-3.0-release.tar.gz
├── manifest.json
├── backend/
├── dist/
└── Dockerfile
```

### Validation pipeline (`packageService` + `manifestService`)

1. **Upload:** size cap (default 512 MB, configurable), gzip magic-byte check,
   filename sanitized to basename and pattern-matched. Saved to `/data/uploads/`.
2. **Safe extraction:** streaming `node-tar` with `preservePaths: false`; reject
   any entry with absolute path or `..` components; **reject all symlinks and
   hardlinks**; cap entry count (default 10,000) and total extracted size
   (default 2 GB); abort + clean up on any violation. Extracts to
   `/data/releases/<version>/`.
3. **Structure:** require `manifest.json`, `backend/`, `dist/`, `Dockerfile`.
4. **Manifest** (zod, unknown fields preserved for forward compatibility):

   ```jsonc
   {
     "product": "REX OS",          // must equal exactly
     "version": "3.0.0",           // strict semver
     "minimumVersion": "2.2.0",    // strict semver
     "releaseType": "stable",      // enum: stable | beta | alpha | rc
     "releaseDate": "2026-08-13"   // ISO date
   }
   ```

5. **Version gating:** uploaded `version` must be ≥ installed version (downgrade
   blocked by default; explicit `allowDowngrade: true` config or request flag
   required); installed version must be ≥ `minimumVersion` (else: "This release
   requires REX OS ≥ x.y.z").
6. **Disk space:** free space on `/data` (extraction + margin) **and** Docker
   storage via `docker systemDf()` must clear configured minimums.
7. **Docker preflight:** engine reachable; target container exists; image name
   pattern sane; no other update in progress.

`POST /api/update/validate` runs all of this dry. `POST /api/update/upgrade`
re-runs it at commit time (validated state can expire).

---

## 10. Upgrade orchestration

Each step: log line → update state → act → verify. The "plan" endpoint returns the
exact ordered list below so the UI can show the user what will happen.

| # | Step | State | Detail |
| --- | --- | --- | --- |
| 1 | Upload complete | `uploaded` | archive stored |
| 2 | Validate | `validated` | package + manifest + version + disk + docker preflight |
| 3 | Preflight | `preparing` | re-check engine, container, disk; compute plan |
| 4 | **Create rollback point** | `backing_up` | `docker inspect` snapshot + tag old image `rexos-<old>-rollback-<ts>`; nothing destroyed |
| 5 | Stop old REX | `installing` | `stop rex-backend` (graceful, timeout) |
| 6 | Prepare new image | `installing` | `docker build -t rex-backend:rexos-<new>` from extracted release (or load/pull per manifest) |
| 7 | Start new REX | `starting` | `create` + `start` container from release config, same name/ports/restart policy, labels incl. `rexos.version` |
| 8 | Health check | `health_check` | registry: `GET /api/health` → 200, `status=="ok"`, `version==expected`; then `GET /api/pipeline` → `ok==true` |
| 9 | Commit | `success` | mark successful, archive rollback point metadata, prune old images per retention |
| — | Any failure ≥ step 5 | `rolling_back → rolled_back` | stop new, restore old from rollback point, start old, health-check old, record result |

**Downtime window** is exactly steps 5–7 (typically seconds), and the plan endpoint
reports it.

---

## 11. Health / functional check registry

`healthService.js` keeps an ordered array of checks so it can grow later:

```js
[
  { id: "health",     kind: "http",  url: "http://rex-backend:4000/api/health",
    expect: { statusCode: 200, body: { status: "ok", version: "<target>" } } },
  { id: "pipeline",   kind: "http",  url: "http://rex-backend:4000/api/pipeline",
    expect: { statusCode: 200, body: { ok: true } } },
  { id: "container",  kind: "docker", expect: { running: true, restartsStable: true } }
]
```

- HTTP checks: GET only, per-check timeout (default 5s) and retry window
  (default: up to 10 attempts over ~30s).
- `version == expected` is verified from the live response — Docker saying "Up" is
  never sufficient.
- Future manifests may declare **additional HTTP checks only** (`path`, `expect`
  fields). Executable checks from archives are never allowed.
- Same registry runs against the **old** container after a rollback.

---

## 12. Rollback strategy

**Rollback point** = `/data/rollback/<id>/`:

- `container.json` — faithful `docker inspect` snapshot of `rex-backend`:
  image, env (0600 perms; **never** logged or served by the API), port bindings,
  mounts/binds, networks, restart policy, labels, cmd/entrypoint, user, working
  dir, healthcheck, resource limits. Stored on the NAS volume so it can recreate
  the container exactly.
- Old image **is never deleted before the upgrade commits** and is additionally
  tagged `rex-backend:rexos-2.2.0-rollback-<ts>`.
- `rollback.json` — id, createdAt, from/to versions, container name, image, reason.

**Restore:** stop new container (if any) → remove it → recreate `rex-backend` from
`container.json` + old image → start → run old-health checks → `rolled_back`.

**Retention:** keep the last N rollback points (default 2); prune only after a
successful upgrade + health pass of the new version.

**Secrets:** env values needed to restore the container live in `container.json`
with 0600 perms on the NAS volume. The API reports only redacted env **names**.
A future option can encrypt the file with a key from env.

---

## 13. Crash recovery

On boot, `stateService` reads `update.json`. If the last state was in-flight
(`backing_up` … `health_check`), the updater enters `needs_recovery` and
**does not auto-destroy anything** — it probes the current `rex-backend` container
and reports:

| Observed condition | Automatic action |
| --- | --- |
| Container running, health OK, version == **target** | Complete the upgrade → `success` (safe: new is already healthy) |
| Container running, health OK, version == **old** | Mark `rolled_back` (old survived), clean temp state, keep rollback point |
| Container running, health OK, version **unknown/other** | `needs_recovery` — surface to operator |
| Container **not running**, rollback point exists | `needs_recovery` — do **not** auto-rollback; offer explicit `resolve` (resume-check or rollback). Operator confirmation required because starting/stopping is destructive without more information |

`POST /api/update/recovery/resolve` is the explicit, audited operator decision.
Recovery decisions are logged to the audit log.

---

## 14. Security model

| Threat | Control |
| --- | --- |
| Browser → Docker | No path: browser talks only to REX OS; updater is network-internal; token-auth API with fixed operations |
| Unauthenticated calls | Bearer token (`UPDATER_API_TOKEN`, long random, set in env; REX OS injects server-side) on every route except `/api/health` |
| Malicious archive | Size caps, gzip check, safe extraction (no `..`, no absolute paths, no symlinks, entry/size limits) |
| Arbitrary command execution | No shell execution from user input anywhere; no `/execute`; no arbitrary docker ops |
| Arbitrary Docker commands | Only fixed, hard-coded operations in `dockerService`; target container/image come from config, not the request |
| Version games | Strict semver; downgrade blocked by default; filename ↔ manifest version consistency |
| Concurrent upgrades | Lock (in-process + on-disk) → `409` |
| Secret leakage | `redact()` on every log line + API responses (masks values of names matching `secret|token|key|password|jwt` and known env names); `container.json` 0600 and never served |
| Auditing | Append-only `audit.log`: action, result, timestamp, source — no payloads/secrets |
| Container hardening | Non-root, read-only rootfs, cap-drop all, no-new-privileges, no privileged mode, unpublished port, isolated network |

---

## 15. Logging

- Ring buffer (last 2,000 lines) in memory + per-attempt file
  `/data/logs/upgrade-<attemptId>.log` + rolling `updater.log`.
- Every write passes through `redact()`; secrets never appear.
- Format: `[22:10:02] Package uploaded` style, with structured fields for
  machine consumption.
- `GET /api/update/logs` returns tail/offset slices; history links each attempt to
  its log file.

## 16. Update history

`/data/state/history.json` — array of:

```jsonc
{
  "id": "uuid",
  "version": "3.0.0",
  "fromVersion": "2.2.0",
  "result": "success",          // success | rolled_back | failed | recovered
  "startedAt": "...", "finishedAt": "...",
  "durationMs": 12345,
  "packageBytes": 14800000,
  "logRef": "upgrade-<id>.log"
}
```

Serves the "REX OS UPDATE HISTORY" UI (3.0.0 Successful, 2.1.0 Rolled back, …)
with per-record log viewing.

---

## 17. Configuration (env vars)

| Variable | Default | Purpose |
| --- | --- | --- |
| `UPDATER_PORT` | `4300` | Updater listen port |
| `UPDATER_API_TOKEN` | *(required)* | Bearer token shared with REX OS |
| `DATA_DIR` | `/data` | Base of all persistent data |
| `TARGET_CONTAINER` | `rex-backend` | Container the updater manages |
| `TARGET_IMAGE_PREFIX` | `rex-backend` | Image name prefix, e.g. `rex-backend:rexos-3.0.0` |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Engine socket path (or `DOCKER_HOST`) |
| `MAX_UPLOAD_BYTES` | `536870912` (512 MB) | Upload cap |
| `MAX_EXTRACT_BYTES` | `2147483648` (2 GB) | Extracted size cap |
| `MAX_ARCHIVE_ENTRIES` | `10000` | Entry count cap |
| `HEALTH_TIMEOUT_MS` / `HEALTH_RETRIES` | `5000` / `10` | HTTP check tuning |
| `ROLLBACK_POINT_RETENTION` | `2` | Kept rollback points |
| `ALLOW_DOWNGRADE` | `false` | Global downgrade gate (per-request flag still required) |
| `LOG_RING_SIZE` | `2000` | In-memory log lines |

---

## 18. Test strategy

| Layer | What | How |
| --- | --- | --- |
| Unit | `semver`, `safeTar` (crafted malicious archives: `../`, absolute, symlink, hardlink, oversized, too many entries, corrupt gzip), manifest zod cases, `redact`, state transitions (invalid transitions rejected), lock (concurrent start → second rejected), version gating (downgrade, minimumVersion) | `node --test test/unit` |
| Integration | Full upgrade flow against a **mock Docker Engine HTTP server** (implements the Engine API subset `dockerode` uses): happy path; injected failures at each step (build fail, start fail, health fail, pipeline fail) → assert automatic rollback + exact old config restored; crash simulation (kill orchestrator mid-flow → boot → recovery decision) | `node --test test/integration` (pure Node, no Docker required — runs in this workspace) |
| E2E (real Docker, on your NAS or dev machine) | Stub REX OS image (tiny HTTP server answering `/api/health` + `/api/pipeline`) + fixture release generator (`test/fixtures/build-release.mjs`). Rehearse: upgrade stub 1.0 → 3.0 on a **test network with a test container name**; forced-failure package → auto-rollback → old stub healthy; concurrent upgrade rejection | `bash test/e2e/run.sh` |
| Manual checklist | curl-based smoke of every endpoint incl. auth rejection, upload size limit, downgrade rejection | `test/manual-checklist.md` |

**Production-safety in tests:** E2E never targets `rex-backend` — it uses stub
containers (`TARGET_CONTAINER=rex-test`) on an isolated network. The updater is
additionally started with a test token and test data dir in every phase.

---

## 19. Implementation phases (incremental, each fully testable)

| Phase | Scope | Touches production? |
| --- | --- | --- |
| **0** | This design | No |
| **1** | Skeleton: server, auth, config, state service, lock, status/logs/history endpoints, `Dockerfile`/compose scaffolding | No |
| **2** | Upload + safe extraction + manifest/version/disk validation (no Docker) | No |
| **3** | Docker service + rollback-point capture + plan endpoint (read-only Docker ops; test against stubs/mock) | No |
| **4** | Upgrade orchestration + health registry + auto-rollback (integration-tested against mock engine + stub containers) | No |
| **5** | Crash recovery, audit log, hardening pass, README, e2e rehearsal | No |
| **6** | REX OS integration — with **separate approval**: attach `rex-backend` to `rex-updater-net`, add server-side proxy routes, add `Settings → System → Updates` UI (new page, additive only) | Yes (additive; container untouched until the user runs the updater themselves) |

---

## 20. Open questions (for approval)

1. **Where should `rex-updater/` live long-term?** Standalone git repo (recommended
   for the "separate project" requirement) vs. staying in this workspace.
2. **New container's configuration source:** For Phase 6, should the new REX OS
   container reuse the *old container's* config (name, ports, env, restart policy)
   — recommended — or read config from the release manifest / env?
3. **Release distribution:** Should the updater also support pulling an image
   directly (e.g. `docker load` from the archive vs. building from the extracted
   `Dockerfile`)? This design defaults to **building** from the release tree;
   `docker load` can be added later.
4. **Downgrade UX:** keep `allowDowngrade` as a config flag + explicit UI confirm,
   or expose it per-request only?
