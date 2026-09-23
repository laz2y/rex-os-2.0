/**
 * REX OS release version — SINGLE SOURCE OF TRUTH.
 *
 * Bump this one constant when cutting a release; every other version report
 * (GET /api/health, the API-only root, diagnostics, backups, the REX Update
 * Manager, the /api/update/status currentVersion) reads it from here.
 *
 * WHY A CONSTANT AND NOT AN ENV VAR:
 *   The REX Updater's post-install gate compares GET /api/health's `version`
 *   with the target version in the release manifest. If that value could be
 *   overridden by a container environment variable, a stale value inherited
 *   from the previous container (the updater re-uses the old container's env
 *   when it creates the replacement) would make a healthy 2.6.0 install
 *   report 2.5.0 — the health check would fail and the upgrade would
 *   automatically roll back. The running version must therefore be derived
 *   from the code that is actually installed, never from the environment.
 */

const APP_VERSION = "2.6.0";

module.exports = { APP_VERSION };
