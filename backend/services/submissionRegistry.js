/**
 * In-memory Direct Link submission registry (REX OS v2.5.0 Fix #1).
 *
 * Keyed by URL fingerprint. Lifecycle:
 *
 *   pending    — an add_package request is in flight. A duplicate request
 *                awaits the SAME promise, so pyLoad's add API is called at
 *                most once per fingerprint (double-click / retry protection).
 *   accepted   — pyLoad acknowledged the package. Duplicates inside the TTL
 *                return the stored result without re-calling pyLoad. After
 *                the TTL the entry expires so a legitimate re-download of an
 *                old URL is never permanently blocked.
 *   ambiguous  — we could not prove the outcome. Duplicates re-run
 *                reconciliation only (never add_package) and may upgrade the
 *                entry to accepted once the package shows up.
 *   rejected   — pyLoad definitively refused the submission and no package
 *                was created. A short TTL debounces immediate re-bursts;
 *                after it, the user may retry.
 *
 * TTLs (defaults, overridable for tests):
 *   accepted  10 min · ambiguous 15 min · rejected 60 s
 *
 * The registry is intentionally in-memory — no new infrastructure, no
 * persistence of signed URLs, and a restart simply resets protection.
 */

const DEFAULT_SUBMISSION_TTLS = {
  accepted: 10 * 60 * 1000,
  ambiguous: 15 * 60 * 1000,
  rejected: 60 * 1000,
};

function createSubmissionRegistry({
  ttls = DEFAULT_SUBMISSION_TTLS,
  now = Date.now,
} = {}) {
  /** @type {Map<string, any>} fingerprint → entry */
  const entries = new Map();

  function prune() {
    const time = now();
    for (const [fingerprint, entry] of entries) {
      if (entry.expiresAt != null && time >= entry.expiresAt) {
        entries.delete(fingerprint);
      }
    }
  }

  return {
    /** Live (unexpired) entry for a fingerprint, or null. */
    get(fingerprint) {
      prune();
      return entries.get(fingerprint) || null;
    },

    /**
     * Mark a fingerprint as pending (or re-open it for a re-check).
     * Single-threaded JS makes this atomic between awaits.
     */
    begin(fingerprint, packageName) {
      prune();
      let entry = entries.get(fingerprint);
      if (!entry) {
        entry = {
          fingerprint,
          packageName,
          state: "pending",
          promise: null,
          result: null,
          packageId: null,
          attempts: 0,
          createdAt: now(),
          updatedAt: now(),
          expiresAt: null,
        };
        entries.set(fingerprint, entry);
      }
      entry.attempts += 1;
      entry.state = "pending";
      entry.updatedAt = now();
      return entry;
    },

    /** Record the final structured result + start the state's TTL window. */
    settle(fingerprint, result) {
      const entry = entries.get(fingerprint);
      if (!entry) return null;

      entry.state = result.status;
      entry.result = result;
      entry.packageId = result.packageId ?? null;
      entry.updatedAt = now();
      entry.promise = null;

      const ttl = ttls[result.status];
      if (!ttl) {
        entries.delete(fingerprint);
        return entry;
      }
      entry.expiresAt = now() + ttl;
      return entry;
    },

    /** Test helper — drop everything. */
    clear() {
      entries.clear();
    },

    /** Current live entry count (diagnostics/tests). */
    get size() {
      prune();
      return entries.size;
    },
  };
}

/** Process-wide default registry used by the pyLoad controller. */
const submissions = createSubmissionRegistry();

module.exports = {
  createSubmissionRegistry,
  DEFAULT_SUBMISSION_TTLS,
  submissions,
};
