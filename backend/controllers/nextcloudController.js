const nextcloud = require("../services/nextcloudService");

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const MAX_USERS = 50;

function nowIso() {
  return new Date().toISOString();
}

/** Normalize a Nextcloud quota object. quota === -3 means unlimited. */
function normalizeQuota(quota) {
  if (!quota) {
    return { used: null, free: null, total: null, relative: null, unlimited: false };
  }

  const unlimited = Number(quota.quota) === -3;
  const toNum = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  return {
    used: toNum(quota.used),
    free: toNum(quota.free),
    total: unlimited ? null : toNum(quota.total),
    relative: toNum(quota.relative),
    unlimited,
  };
}

/** Fetch up to MAX_USERS user records (parallel, best-effort). */
async function getUserDetails() {
  const ids = await nextcloud.getUsers();
  const details = await Promise.all(
    ids.slice(0, MAX_USERS).map((id) => nextcloud.getUser(id).catch(() => null))
  );
  return { total: ids.length, details };
}

/** GET /api/nextcloud/status — online state, version, last checked. */
exports.getStatus = async (req, res) => {
  const checked = nowIso();

  try {
    if (!process.env.NEXTCLOUD_URL) {
      throw new Error("NEXTCLOUD_URL not configured");
    }

    const status = await nextcloud.getStatus();

    res.json({
      online: true,
      version: status.version || null,
      versionString: status.versionstring || null,
      product: status.productname || "Nextcloud",
      maintenance: Boolean(status.maintenance),
      needsDbUpgrade: Boolean(status.needsDbUpgrade),
      lastChecked: checked,
    });
  } catch (error) {
    console.error("[Nextcloud] status:", error.response?.data || error.message);

    res.json({
      online: false,
      version: null,
      versionString: null,
      product: null,
      maintenance: null,
      needsDbUpgrade: null,
      lastChecked: checked,
    });
  }
};

/** GET /api/nextcloud/info — user counts + server version. */
exports.getInfo = async (req, res) => {
  try {
    const [users, capabilities] = await Promise.all([
      nextcloud.getUsers(),
      nextcloud.getCapabilities().catch(() => null),
    ]);

    // "Active users" = logged in within 30 days. Only reported when every
    // user record exposes lastLogin (it is missing on some Nextcloud versions).
    let activeUsers = null;
    let lastLogin = null;

    if (users.length) {
      const details = await Promise.all(
        users
          .slice(0, MAX_USERS)
          .map((id) => nextcloud.getUser(id).catch(() => null))
      );
      const complete = details.every((detail) => detail && typeof detail.lastLogin === "number");
      if (complete && details.length) {
        const now = Date.now();
        lastLogin = Math.max(...details.map((detail) => detail.lastLogin));
        activeUsers = details.filter(
          (detail) => now - detail.lastLogin < ACTIVE_WINDOW_MS
        ).length;
      }
    }

    res.json({
      available: true,
      totalUsers: users.length,
      activeUsers,
      lastLogin,
      totalFiles: null, // not exposed via the OCS API
      serverVersion: capabilities?.capabilities?.nextcloud?.system?.version || null,
    });
  } catch (error) {
    console.error("[Nextcloud] info:", error.response?.data || error.message);

    res.status(500).json({
      available: false,
      totalUsers: null,
      activeUsers: null,
      lastLogin: null,
      totalFiles: null,
      serverVersion: null,
    });
  }
};

/** GET /api/nextcloud/users — real users with quota / storage detail. */
exports.getUsers = async (req, res) => {
  try {
    const { total, details } = await getUserDetails();

    const users = details
      .filter(Boolean)
      .map((detail) => ({
        id: detail.id,
        displayName: detail["display-name"] || detail.displayname || detail.id,
        email: detail.email || null,
        lastLogin: typeof detail.lastLogin === "number" ? detail.lastLogin : null,
        ...normalizeQuota(detail.quota),
      }));

    res.json({ available: true, total, users });
  } catch (error) {
    console.error("[Nextcloud] users:", error.response?.data || error.message);

    res.status(500).json({ available: false, total: 0, users: [] });
  }
};

/** GET /api/nextcloud/storage — aggregated from real user quotas. */
exports.getStorage = async (req, res) => {
  try {
    const { details } = await getUserDetails();

    let used = 0;
    let total = 0;
    let hasData = false;

    for (const detail of details) {
      if (!detail?.quota) continue;

      const quotaUsed = Number(detail.quota.used);
      const quotaTotal = Number(detail.quota.total);

      if (Number.isFinite(quotaUsed) && quotaUsed > 0) {
        used += quotaUsed;
        hasData = true;
      }
      // quota === -3 (unlimited) or 0 (default) contributes no total
      if (Number.isFinite(quotaTotal) && quotaTotal > 0) {
        total += quotaTotal;
      }
    }

    if (!hasData || total <= 0) {
      res.json({
        available: true,
        used: null,
        free: null,
        total: null,
        usagePercent: null,
        source: "user-quota-aggregate",
      });
      return;
    }

    res.json({
      available: true,
      used,
      free: Math.max(0, total - used),
      total,
      usagePercent: Math.min(100, Math.round((used / total) * 1000) / 10),
      source: "user-quota-aggregate",
    });
  } catch (error) {
    console.error("[Nextcloud] storage:", error.response?.data || error.message);

    res.status(500).json({
      available: false,
      used: null,
      free: null,
      total: null,
      usagePercent: null,
      source: null,
    });
  }
};

/** GET /api/nextcloud/activity — recent activity when the API provides it. */
exports.getActivity = async (req, res) => {
  try {
    const items = await nextcloud.getActivity();

    res.json({
      available: true,
      activities: (items || []).slice(0, 12).map((item) => ({
        id: item.activity_id,
        app: item.app || null,
        type: item.type || null,
        user: item.user || null,
        subject:
          (Array.isArray(item.subject_formatted) && item.subject_formatted[0]) ||
          item.subject ||
          null,
        objectName: item.object_name || null,
        timestamp:
          item.timestamp != null ? Number(item.timestamp) * 1000 : null,
      })),
    });
  } catch (error) {
    console.error("[Nextcloud] activity:", error.response?.data || error.message);

    res.json({ available: false, activities: [] });
  }
};
