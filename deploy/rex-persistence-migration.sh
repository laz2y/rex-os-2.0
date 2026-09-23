#!/bin/sh
# =============================================================================
# REX OS — ONE-TIME PERSISTENCE MIGRATION (rex-backend ONLY)
# =============================================================================
# Makes the CURRENT production credentials + runtime state persistent before
# REX OS 2.6.0 is installed.
#
#   /volume1/docker/rex/config/.auth-secrets.json -> <auth path in image>:ro
#   /volume1/docker/rex/runtime                   -> <data dir in image>:rw
#
# TOUCHES ONLY: the rex-backend container + the two host directories above.
# Never touches: pyLoad, rex-arr-importer, Sonarr, Radarr, qBittorrent,
# Jellyfin, rex-updater, Docker networks, media, credentials, REX source,
# the REX image.
#
# SAFETY: defaults to DRY RUN — it prints every command, changes nothing.
#         Execute for real with:   APPLY=1 sh deploy/rex-persistence-migration.sh
#
# The script NEVER prints secret values. Raw `docker inspect` output (which
# contains env values) is written to a 0600 file and not shown; the sanitized
# copy keeps key names only.
# =============================================================================

set -eu

CONTAINER=${CONTAINER:-rex-backend}
ROOT=${ROOT:-/volume1/docker/rex}
APPLY=${APPLY:-0}
# 1 = also mount the same host storage at the ALTERNATE layout path, so the
#     mounts keep matching after the 2.6.0 image is swapped in. Recommended.
DUAL_LAYOUT=${DUAL_LAYOUT:-1}

TS=$(date +%Y%m%d-%H%M%S)
BACKUP="$ROOT/backup/rex-persistence-migration-$TS"
CONFIG_HOST="$ROOT/config/.auth-secrets.json"
RUNTIME_HOST="$ROOT/runtime"
MARKER=".rex-persistence-probe-$TS"

CREATED=0      # set once the replacement container exists
RENAMED=""     # set when the old container is renamed

log()  { printf '%s\n' "$*"; }
step() { printf '\n=== %s ===\n' "$*"; }
warn() { printf '!! %s\n' "$*"; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# Run a command for real (APPLY=1) or just show it (dry run).
run() {
  if [ "$APPLY" = 1 ]; then "$@"; else printf '  [dry-run] %s\n' "$*"; fi
}
# Same, for shell snippets needing pipes/redirects.
runsh() {
  if [ "$APPLY" = 1 ]; then sh -c "$1"; else printf '  [dry-run] %s\n' "$1"; fi
}
# Always-read-only helper.
sh_now() { sh -c "$1"; }

# =============================================================================
# PHASE 0 — PREFLIGHT
# =============================================================================
step "PHASE 0 — preflight"
command -v docker >/dev/null 2>&1 || die "docker CLI not found — run this ON the NAS."
[ "$CONTAINER" = "rex-backend" ] || die "refusing to run against '$CONTAINER' (guard: rex-backend only)."
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "container '$CONTAINER' not found."

IMAGE=$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")
IMAGE_ID=$(docker inspect -f '{{.Image}}' "$CONTAINER")
RUNNING=$(docker inspect -f '{{.State.Running}}' "$CONTAINER")
log "container : $CONTAINER (running=$RUNNING)"
log "image     : $IMAGE"
log "image ID  : $IMAGE_ID"
log "mode      : $([ "$APPLY" = 1 ] && echo APPLY || echo 'DRY RUN (nothing will change)')"
[ "$APPLY" = 1 ] || log "            re-run with APPLY=1 to execute"

# ---- Detect where the RUNNING image actually keeps auth + data --------------
# The live layout is authoritative — never assume /app vs /app/backend.
AUTH_IN_IMAGE=$(sh_now "docker exec $CONTAINER sh -c 'for p in /app/.auth-secrets.json /app/backend/.auth-secrets.json; do [ -f \"\$p\" ] && echo \$p; done' | head -1")
DATA_IN_IMAGE=$(sh_now "docker exec $CONTAINER sh -c 'for d in /app/data /app/backend/data; do [ -d \"\$d\" ] && echo \$d; done' | head -1")
[ -n "$AUTH_IN_IMAGE" ] || die "no .auth-secrets.json found inside the container (/app or /app/backend)."
[ -n "$DATA_IN_IMAGE" ] || die "no data dir found inside the container (/app or /app/backend)."

# Hard guards: a wrong pairing here would mount runtime over the credentials.
case "$AUTH_IN_IMAGE" in
  */.auth-secrets.json) : ;;
  *) die "auth probe returned '$AUTH_IN_IMAGE' — refusing to continue." ;;
esac
case "$DATA_IN_IMAGE/" in
  */data/) : ;;
  *) die "data probe returned '$DATA_IN_IMAGE' — refusing to continue." ;;
esac
[ "$AUTH_IN_IMAGE" != "$DATA_IN_IMAGE" ] || die "auth and data resolved to the same path — refusing."

# The alternate path for the other layout (/app <-> /app/backend).
case "$AUTH_IN_IMAGE" in
  /app/.auth-secrets.json)          AUTH_ALT="/app/backend/.auth-secrets.json" ;;
  /app/backend/.auth-secrets.json)  AUTH_ALT="/app/.auth-secrets.json" ;;
  *) die "unexpected auth path '$AUTH_IN_IMAGE'" ;;
esac
case "$DATA_IN_IMAGE" in
  /app/data)          DATA_ALT="/app/backend/data" ;;
  /app/backend/data)  DATA_ALT="/app/data" ;;
  *) die "unexpected data path '$DATA_IN_IMAGE'" ;;
esac

log "auth path : $AUTH_IN_IMAGE   (live layout, detected)"
log "data path : $DATA_IN_IMAGE   (live layout, detected)"
if [ "$DUAL_LAYOUT" = 1 ]; then
  log "also mount: $AUTH_ALT , $DATA_ALT   (DUAL_LAYOUT=1)"
  warn "Both layouts point at the SAME host storage, so REX keeps working"
  warn "whether the running image keeps the backend at /app or /app/backend"
  warn "(the 2.6.0 archive Dockerfile uses /app/backend). Without this, the"
  warn "2.6 upgrade would read the image's baked-in credentials and an empty data dir."
else
  warn "DUAL_LAYOUT=0 — mounts will only match the CURRENT image layout."
fi

# =============================================================================
# PHASE 1 — CAPTURE CURRENT SPEC
# =============================================================================
step "PHASE 1 — capture current spec -> $BACKUP"
run mkdir -p "$BACKUP"
run chmod 700 "$BACKUP"

# Raw inspect (contains env values) — file only, never printed.
if [ "$APPLY" = 1 ]; then
  docker inspect "$CONTAINER" > "$BACKUP/container-inspect.json"
  chmod 600 "$BACKUP/container-inspect.json"
  docker image inspect "$IMAGE" > "$BACKUP/image-inspect.json" 2>/dev/null || true
  docker ps -a --no-trunc --filter "name=^/$CONTAINER$" > "$BACKUP/docker-ps.txt" 2>&1 || true
else
  log "  [dry-run] write container-inspect.json (0600), image-inspect.json, docker-ps.txt"
fi

# Sanitized spec (secret values redacted) — safe to read/share.
if [ "$APPLY" = 1 ]; then
  sed -E 's/("[A-Za-z0-9_]+=)[^"]*"/\1<redacted>"/g' \
    "$BACKUP/container-inspect.json" > "$BACKUP/container-inspect.sanitized.json"
  chmod 644 "$BACKUP/container-inspect.sanitized.json"
else
  log "  [dry-run] write container-inspect.sanitized.json (env values <redacted>)"
fi

# Compose-managed containers get recreated by the next `compose up`, which
# would silently drop the new mounts. Detect before changing anything.
if docker inspect -f '{{json .Config.Labels}}' "$CONTAINER" 2>/dev/null | grep -q 'com.docker.compose.project'; then
  warn "rex-backend carries docker-compose labels — recreating it by hand will"
  warn "be UNDONE on the next 'docker compose up'. Add the two mounts to that"
  warn "compose file instead (same image, same settings, plus the volumes)."
  [ "${FORCE:-0}" = 1 ] || die "refusing to continue (set FORCE=1 if you have verified it is safe)."
fi

if [ "$APPLY" = 1 ]; then
  {
    echo "REX OS persistence migration — captured spec"
    echo "timestamp        : $TS"
    echo "container        : $CONTAINER"
    echo "image            : $IMAGE"
    echo "image ID         : $IMAGE_ID"
    echo "running          : $RUNNING"
    echo "auth path (image): $AUTH_IN_IMAGE"
    echo "data path (image): $DATA_IN_IMAGE"
    echo "entrypoint       : $(docker inspect -f '{{json .Config.Entrypoint}}' "$CONTAINER")"
    echo "command          : $(docker inspect -f '{{json .Config.Cmd}}' "$CONTAINER")"
    echo "working dir      : $(docker inspect -f '{{.Config.WorkingDir}}' "$CONTAINER")"
    echo "user             : $(docker inspect -f '{{.Config.User}}' "$CONTAINER")"
    echo "ports            : $(docker inspect -f '{{json .HostConfig.PortBindings}}' "$CONTAINER")"
    echo "restart policy   : $(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$CONTAINER")"
    echo "network mode     : $(docker inspect -f '{{.HostConfig.NetworkMode}}' "$CONTAINER")"
    echo "networks         : $(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$CONTAINER")"
    echo "healthcheck      : $(docker inspect -f '{{json .Config.Healthcheck}}' "$CONTAINER")"
    echo "labels           : $(docker inspect -f '{{json .Config.Labels}}' "$CONTAINER")"
    echo "current mounts   :"
    docker inspect -f '{{range .Mounts}}  {{.Type}} {{.Source}} -> {{.Destination}} ({{if .RW}}rw{{else}}ro{{end}}){{"\n"}}{{end}}' "$CONTAINER"
    echo "env variable names (no values):"
    docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" | cut -d= -f1 | sort | sed 's/^/  /'
  } > "$BACKUP/spec-summary.txt"
  log "spec summary   : $BACKUP/spec-summary.txt"
else
  log "  [dry-run] spec summary -> $BACKUP/spec-summary.txt (env values not printed)"
fi

# =============================================================================
# PHASE 2 — BACK UP CURRENT DATA (exact copy, contents never printed)
# =============================================================================
step "PHASE 2 — back up current data"
run mkdir -p "$BACKUP/container-data"
runsh "docker cp '$CONTAINER:$DATA_IN_IMAGE/.' '$BACKUP/container-data/'"
runsh "docker cp '$CONTAINER:$AUTH_IN_IMAGE' '$BACKUP/.auth-secrets.json'"

if [ "$APPLY" = 1 ]; then
  AUTH_SHA_IN=$(docker exec "$CONTAINER" sha256sum "$AUTH_IN_IMAGE" | cut -d' ' -f1)
  AUTH_SHA_BK=$(sha256sum "$BACKUP/.auth-secrets.json" | cut -d' ' -f1)
  [ "$AUTH_SHA_IN" = "$AUTH_SHA_BK" ] || die "auth backup SHA-256 mismatch — nothing was changed."
  echo "auth sha256           : $AUTH_SHA_IN"            > "$BACKUP/verification.txt"
  echo "auth sha256 (backup)  : $AUTH_SHA_BK"           >> "$BACKUP/verification.txt"
  echo "auth bytes            : $(stat -c %s "$BACKUP/.auth-secrets.json")" >> "$BACKUP/verification.txt"
  echo "auth owner/mode       : $(stat -c '%U:%G %a' "$BACKUP/.auth-secrets.json")" >> "$BACKUP/verification.txt"
  echo "data files (backup)   : $(find "$BACKUP/container-data" -type f | wc -l)" >> "$BACKUP/verification.txt"
  echo "data size KB (backup)  : $(du -sk "$BACKUP/container-data" | cut -f1)"    >> "$BACKUP/verification.txt"
  echo "data files (container): $(docker exec "$CONTAINER" sh -c "find '$DATA_IN_IMAGE' -type f | wc -l")" >> "$BACKUP/verification.txt"
  echo "data size KB (contain) : $(docker exec "$CONTAINER" sh -c "du -sk '$DATA_IN_IMAGE' | cut -f1")"     >> "$BACKUP/verification.txt"
  echo "data owner/mode       : $(stat -c '%U:%G %a' "$BACKUP/container-data")" >> "$BACKUP/verification.txt"
  cat "$BACKUP/verification.txt"
else
  log "  [dry-run] docker cp $CONTAINER:$DATA_IN_IMAGE/. -> $BACKUP/container-data/"
  log "  [dry-run] docker cp $CONTAINER:$AUTH_IN_IMAGE   -> $BACKUP/.auth-secrets.json"
  log "  [dry-run] sha256 + file-count/size/owner verification -> verification.txt"
fi

# =============================================================================
# PHASE 3 — PREPARE PERSISTENT HOST PATHS
# =============================================================================
step "PHASE 3 — prepare persistent host paths"
run mkdir -p "$ROOT/config" "$ROOT/runtime"
runsh "cp -a '$BACKUP/.auth-secrets.json' '$CONFIG_HOST'"
runsh "cp -a '$BACKUP/container-data/.' '$RUNTIME_HOST/'"
run chown -R root:root "$RUNTIME_HOST"
run chown root:root "$CONFIG_HOST"
run chmod 700 "$ROOT/config"
run chmod 600 "$CONFIG_HOST"
run chmod 755 "$RUNTIME_HOST"

if [ "$APPLY" = 1 ]; then
  HOST_SHA=$(sha256sum "$CONFIG_HOST" | cut -d' ' -f1)
  [ "$HOST_SHA" = "$AUTH_SHA_BK" ] || die "host auth copy SHA-256 mismatch — aborting before recreate."
  echo "auth sha256 (host)    : $HOST_SHA"      >> "$BACKUP/verification.txt"
  echo "auth sha256 match     : YES (container = backup = host)" >> "$BACKUP/verification.txt"
  echo "runtime files (host)  : $(find "$RUNTIME_HOST" -type f | wc -l)" >> "$BACKUP/verification.txt"
  echo "runtime size KB (host): $(du -sk "$RUNTIME_HOST" | cut -f1)"    >> "$BACKUP/verification.txt"
  log "auth sha256 (host)    : $HOST_SHA  (matches backup + container)"
else
  log "  [dry-run] chown root:root + chmod 700/600 on $ROOT/config"
  log "  [dry-run] chown -R root:root + chmod 755 on $RUNTIME_HOST"
  log "  [dry-run] verify host auth sha256 == container auth sha256"
fi

# =============================================================================
# PHASE 4 — RECREATE ONLY rex-backend (same image, same settings, + 2 mounts)
# =============================================================================
step "PHASE 4 — recreate rex-backend"

# --- 4a. Re-apply every runtime setting WITHOUT printing secrets ------------
# The env file is generated from the live container's own inspect output.
if [ "$APPLY" = 1 ]; then
  docker inspect "$CONTAINER" > "$BACKUP/.inspect-for-env.json"
  chmod 600 "$BACKUP/.inspect-for-env.json"
  docker run --rm -i --network none --entrypoint node "$IMAGE" -e '
    let raw = "";
    process.stdin.on("data", (d) => (raw += d)).on("end", () => {
      const c = JSON.parse(raw)[0];
      const env = (c.Config && c.Config.Env) || [];
      for (const line of env) {
        const i = line.indexOf("=");
        const key = i < 0 ? line : line.slice(0, i);
        const value = i < 0 ? "" : line.slice(i + 1);
        if (/[\n\r]/.test(value)) {
          process.stderr.write("WARN: value for " + key + " contains a newline; check the env file\n");
          continue;
        }
        if (key === "PATH") continue;
        process.stdout.write(key + "=" + value + "\n");
      }
    });
  ' < "$BACKUP/.inspect-for-env.json" > "$BACKUP/env.list"
  chmod 600 "$BACKUP/env.list"
  ENV_COUNT=$(wc -l < "$BACKUP/env.list")
  log "env file              : $BACKUP/env.list (0600, $ENV_COUNT vars, values NOT shown)"
else
  log "  [dry-run] generate $BACKUP/env.list (0600) from the container's own env"
fi

# Labels / healthcheck overrides, re-applied verbatim from inspect.
if [ "$APPLY" = 1 ]; then
  docker inspect "$CONTAINER" > "$BACKUP/.inspect-for-flags.json"
  chmod 600 "$BACKUP/.inspect-for-flags.json"
  docker run --rm -i --network none --entrypoint node "$IMAGE" -e '
    let raw = "";
    process.stdin.on("data", (d) => (raw += d)).on("end", () => {
      const c = JSON.parse(raw)[0];
      const out = [];
      const labels = (c.Config && c.Config.Labels) || {};
      for (const k of Object.keys(labels)) out.push("--label=" + k + "=" + labels[k]);
      const hc = c.Config && c.Config.Healthcheck;
      if (hc && Array.isArray(hc.Test)) {
        const cmd = hc.Test.slice(1).join(" ");
        if (cmd) out.push("--health-cmd=" + cmd);
        if (hc.Interval && hc.Interval > 0) out.push("--health-interval=" + hc.Interval + "ns");
        if (hc.Timeout && hc.Timeout > 0) out.push("--health-timeout=" + hc.Timeout + "ns");
        if (hc.StartPeriod && hc.StartPeriod > 0) out.push("--health-start-period=" + hc.StartPeriod + "ns");
        if (hc.Retries && hc.Retries > 0) out.push("--health-retries=" + hc.Retries);
      }
      process.stdout.write(out.join("\n"));
    });
  ' < "$BACKUP/.inspect-for-flags.json" > "$BACKUP/create-flags.list"
  chmod 600 "$BACKUP/create-flags.list"
  log "flags file            : $BACKUP/create-flags.list ($(wc -l < "$BACKUP/create-flags.list") flags)"
else
  log "  [dry-run] generate $BACKUP/create-flags.list (labels + healthcheck from inspect)"
fi

# --- 4b. Keep the old container as the rollback artifact --------------------
RENAMED="${CONTAINER}-pre-migration-$TS"
log "rollback container    : $RENAMED (same image, same spec, stopped)"
run docker rename "$CONTAINER" "$RENAMED"
run docker stop "$RENAMED"
if [ "$APPLY" = 1 ] && ! docker inspect "$RENAMED" -f '{{.Config.Image}}' > "$BACKUP/rollback-container.txt" 2>/dev/null; then
  warn "could not record the rollback container spec"
fi
log "  (the previous image '$IMAGE' is NOT deleted: $IMAGE_ID)"

# --- 4c. Create + start the replacement (same spec, two added mounts) -------
# $@ is function-local, so building the flag list here cannot leak.
# $@ is function-local, so building the flag list here cannot leak out.
create_container() {
  set --
  if [ -f "$BACKUP/create-flags.list" ]; then
    while IFS= read -r line; do
      [ -n "$line" ] && set -- "$@" "$line"
    done < "$BACKUP/create-flags.list"
  fi
  if [ "$DUAL_LAYOUT" = 1 ]; then
    set -- "$@" \
      --volume "$CONFIG_HOST:$AUTH_ALT:ro" \
      --volume "$RUNTIME_HOST:$DATA_ALT:rw"
  fi
  if [ "$APPLY" = 1 ]; then
    docker create \
      --name "$CONTAINER" \
      --restart unless-stopped \
      --publish 4000:4000 \
      --network bridge \
      --env-file "$BACKUP/env.list" \
      --volume "$CONFIG_HOST:$AUTH_IN_IMAGE:ro" \
      --volume "$RUNTIME_HOST:$DATA_IN_IMAGE:rw" \
      "$@" \
      "$IMAGE"
  else
    printf '  [dry-run] docker create --name %s --restart unless-stopped --publish 4000:4000 --network bridge \\\n' "$CONTAINER"
    printf '              --env-file %s \\\n' "$BACKUP/env.list"
    printf '              --volume %s:%s:ro \\\n' "$CONFIG_HOST" "$AUTH_IN_IMAGE"
    printf '              --volume %s:%s:rw \\\n' "$RUNTIME_HOST" "$DATA_IN_IMAGE"
    if [ "$DUAL_LAYOUT" = 1 ]; then
      printf '              --volume %s:%s:ro \\\n' "$CONFIG_HOST" "$AUTH_ALT"
      printf '              --volume %s:%s:rw \\\n' "$RUNTIME_HOST" "$DATA_ALT"
    fi
    printf '              <labels/healthcheck flags from create-flags.list> %s\n' "$IMAGE"
  fi
}

if [ "$APPLY" = 1 ]; then
  create_container
  docker start "$CONTAINER"
  CREATED=1
else
  create_container
  log "  [dry-run] docker start $CONTAINER"
fi

# =============================================================================
# PHASE 5 — VALIDATION
# =============================================================================
step "PHASE 5 — validation"

wait_health() {
  i=0
  while [ "$i" -lt 60 ]; do
    s=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo unknown)
    [ "$s" = "healthy" ] && return 0
    i=$((i + 1)); sleep 2
  done
  return 1
}
curl_status() { curl -s -o /tmp/rex-probe.$$ -w '%{http_code}' -m 10 "http://127.0.0.1:4000$1" 2>/dev/null || echo 000; }

if [ "$APPLY" = 1 ]; then
  log "1) docker ps"
  docker ps --filter "name=^/$CONTAINER$" --format '   {{.Names}}  {{.Status}}  {{.Image}}'

  log "2) docker health"
  if wait_health; then log "   health: healthy"; else warn "health not healthy within 120s"; fi

  log "3) GET /api/health"
  CODE=$(curl_status /api/health)
  BODY=$(cat /tmp/rex-probe.$$ 2>/dev/null || echo "")
  log "   HTTP $CODE  $BODY"

  log "4) GET / (must be the React shell, not the API-only JSON root)"
  CODE=$(curl_status /)
  HEAD=$(head -c 120 /tmp/rex-probe.$$ 2>/dev/null || echo "")
  log "   HTTP $CODE  ${HEAD}"
  case "$HEAD" in
    *'{"app":"REX API"'*) warn "ROOT IS API-ONLY JSON — frontend not served (check dist layout)";;
  esac

  log "5) GET /pipeline (SPA route)"
  log "   HTTP $(curl_status /pipeline)"

  log "6) GET /api/pipeline (Jellyfin degraded is expected and NOT fixed here)"
  log "   HTTP $(curl_status /api/pipeline)"

  log "7) active mounts"
  docker inspect -f '{{range .Mounts}}   {{.Source}} -> {{.Destination}} ({{if .RW}}rw{{else}}ro{{end}}){{"\n"}}{{end}}' "$CONTAINER"

  log "8) state files inside the container"
  for f in activity.json notifications.json pipeline-state.json recovery.json; do
    if docker exec "$CONTAINER" sh -c "[ -f '$DATA_IN_IMAGE/$f' ]"; then
      log "   OK   $DATA_IN_IMAGE/$f"
    else
      warn "MISSING $DATA_IN_IMAGE/$f"
    fi
  done

  log "9) auth file identity (mounted file must win over any baked-in copy)"
  IN_SHA=$(docker exec "$CONTAINER" sha256sum "$AUTH_IN_IMAGE" | cut -d' ' -f1)
  log "   container sha256 : $IN_SHA"
  log "   expected sha256  : $AUTH_SHA_BK"
  if [ "$IN_SHA" = "$AUTH_SHA_BK" ]; then
    log "   MATCH — production credentials are in effect"
  else
    warn "MISMATCH — the container is NOT reading the mounted production file"
  fi
  if [ "$DUAL_LAYOUT" = 1 ]; then
    log "   dormant-layout path $AUTH_ALT:"
    if docker exec "$CONTAINER" sh -c "[ -f '$AUTH_ALT' ]"; then
      ALT_SHA=$(docker exec "$CONTAINER" sha256sum "$AUTH_ALT" | cut -d' ' -f1)
      if [ "$ALT_SHA" = "$AUTH_SHA_BK" ]; then
        log "     MATCH — whichever layout 2.6.0 uses, the real credentials apply"
      else
        warn "     MISMATCH at the alternate path — check the mount"
      fi
    else
      warn "     alternate auth path is not a file (mount did not take) — 2.6.0 could"
      warn "     fall back to baked-in credentials if the new image moves the backend"
    fi
  fi

  log "10) auth endpoint liveness (no credentials used or printed)"
  log "    GET /api/auth/me        -> HTTP $(curl_status /api/auth/me)  (401 expected when logged out)"
  log "    POST /api/auth/login    -> HTTP $(curl -s -o /dev/null -w '%{http_code}' -m 10 -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:4000/api/auth/login)  (400/401 expected)"
  log "    Sign in once through the browser to confirm the real password is accepted."
else
  log "  [dry-run] skipped all live checks (docker ps / health / curl / mounts / sha256)"
fi

# =============================================================================
# PHASE 6 — WRITE PERSISTENCE TEST (non-destructive marker)
# =============================================================================
step "PHASE 6 — persistence proof marker"
log "marker: $DATA_IN_IMAGE/$MARKER  <->  $RUNTIME_HOST/$MARKER"
if [ "$APPLY" = 1 ]; then
  docker exec "$CONTAINER" sh -c "touch '$DATA_IN_IMAGE/$MARKER'"
  if [ -f "$RUNTIME_HOST/$MARKER" ]; then
    log "   PASS — the marker appeared on persistent NAS storage"
  else
    warn "FAIL — marker did not reach $RUNTIME_HOST (data is NOT persistent)"
  fi
  rm -f "$RUNTIME_HOST/$MARKER"
  docker exec "$CONTAINER" sh -c "rm -f '$DATA_IN_IMAGE/$MARKER'"
  if [ -f "$RUNTIME_HOST/$MARKER" ]; then warn "marker removal failed — remove it manually"; else log "   marker removed"; fi
  if docker exec "$CONTAINER" sh -c "[ -f '$DATA_IN_IMAGE/$MARKER' ]"; then warn "marker still inside container"; fi
else
  log "  [dry-run] touch inside container -> assert on host -> remove"
fi

# =============================================================================
# REPORT
# =============================================================================
step "DONE"
cat <<EOF
backup path        : $BACKUP
rollback container : $RENAMED   (stopped, same image $IMAGE)
previous image     : $IMAGE_ID  (kept)
mounts added       : $CONFIG_HOST -> $AUTH_IN_IMAGE (ro)
                     $RUNTIME_HOST -> $DATA_IN_IMAGE (rw)
secrets on disk    : $BACKUP/env.list and $BACKUP/container-inspect.json are 0600
                     (they hold the container env) — delete them once 2.6.0 is validated.
rollback           : ROLLBACK=1 APPLY=1 sh deploy/rex-persistence-migration.sh
                     (stops+removes the new container, restores the renamed one)
2.6.0 prerequisite : the release Dockerfile must keep the SAME layout
                     (auth at $AUTH_IN_IMAGE, data at $DATA_IN_IMAGE).
EOF

# =============================================================================
# ROLLBACK (run this if any critical validation failed)
# =============================================================================
if [ "$APPLY" = 1 ] && [ "${ROLLBACK:-0}" = 1 ]; then
  step "ROLLBACK"
  [ "$CREATED" = 1 ] && { docker stop "$CONTAINER" || true; docker rm "$CONTAINER" || true; }
  docker rename "$RENAMED" "$CONTAINER"
  docker start "$CONTAINER"
  sleep 5
  docker ps --filter "name=^/$CONTAINER$" --format '   {{.Names}}  {{.Status}}'
  log "   GET /api/health -> HTTP $(curl_status /api/health)  $(cat /tmp/rex-probe.$$ 2>/dev/null)"
  log "   persistent copies left in place: $CONFIG_HOST , $RUNTIME_HOST , $BACKUP"
fi
rm -f /tmp/rex-probe.$$ 2>/dev/null || true
