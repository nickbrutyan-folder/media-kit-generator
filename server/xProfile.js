// Sorsa-backed X profile fetch with 24h SQLite cache.
//
// Exports:
//   getXProfile(db, username, { apiKey })  →  { profile, cached } | throws
//   getSorsaUsage(apiKey)                  →  Sorsa /key-usage-info passthrough
//
// Scope: lightweight — we ONLY call /info (1 Sorsa credit per fresh fetch,
// cached 24h per username). Returns display name, bio, avatar, follower count
// and a handful of identity flags. Engagement stats stay manual / CSV-filled.

const SORSA_BASE = "https://api.sorsa.io/v3";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const UPSTREAM_TIMEOUT_MS = 8_000;

/** Normalize "@handle" / "https://x.com/handle" / "Handle" → "handle". */
export function normalizeHandle(input) {
  const raw = String(input || "").trim();
  const urlMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/(@?\w+)/i);
  const stripped = (urlMatch ? urlMatch[1] : raw).replace(/^@/, "");
  return stripped.toLowerCase();
}

/** fetch() with an abortable timeout. */
async function sorsaFetch(path, apiKey, { method = "GET", body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(`${SORSA_BASE}${path}`, {
      method,
      headers: {
        ApiKey: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { message: text }; }
    return { status: res.status, body: parsed };
  } finally {
    clearTimeout(timer);
  }
}

function toInt(v) {
  const n = parseInt(String(v ?? "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Slim the Sorsa /info response to exactly what the frontend needs. */
function shapeResult(info) {
  return {
    username:          info?.username || null,
    display_name:      info?.display_name || null,
    description:       info?.description || null,
    profile_image_url: info?.profile_image_url || null,
    banner_url:        info?.profile_background_image_url || null,
    followers_count:   toInt(info?.followers_count),
    following_count:   toInt(info?.followings_count),
    tweets_count:      toInt(info?.tweets_count),
    verified:          Boolean(info?.verified),
    protected:         Boolean(info?.protected),
    location:          info?.location || null,
    created_at:        info?.created_at || null,
  };
}

function cacheStmts(db) {
  if (!db.__xCacheStmts) {
    db.__xCacheStmts = {
      get: db.prepare(
        "SELECT data_json, fetched_at, CAST((julianday('now') - julianday(fetched_at)) * 86400000 AS INTEGER) AS age_ms FROM x_profile_cache WHERE username = ?",
      ),
      upsert: db.prepare(`
        INSERT INTO x_profile_cache (username, data_json, fetched_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(username) DO UPDATE SET
          data_json  = excluded.data_json,
          fetched_at = CURRENT_TIMESTAMP
      `),
    };
  }
  return db.__xCacheStmts;
}

/** Main entry. Throws { status, message, detail? } on errors. */
export async function getXProfile(db, usernameInput, { apiKey, force = false } = {}) {
  if (!apiKey) throw { status: 503, message: "sorsa-not-configured" };

  const username = normalizeHandle(usernameInput);
  if (!username || !/^\w{1,30}$/.test(username)) {
    throw { status: 400, message: "invalid-username" };
  }

  const { get, upsert } = cacheStmts(db);

  // 1) cache hit?
  if (!force) {
    const row = get.get(username);
    if (row && typeof row.age_ms === "number" && row.age_ms < CACHE_TTL_MS) {
      try {
        return { profile: JSON.parse(row.data_json), cached: true, age_ms: row.age_ms };
      } catch {
        // fall through to fresh fetch
      }
    }
  }

  // 2) fresh fetch — /info only (1 Sorsa credit)
  let info;
  try {
    info = await sorsaFetch(`/info?username=${encodeURIComponent(username)}`, apiKey);
  } catch (e) {
    throw { status: 502, message: "sorsa-unreachable", detail: e?.message };
  }

  if (info.status === 404) throw { status: 404, message: "user-not-found" };
  if (info.status === 401 || info.status === 403) {
    throw { status: 502, message: "sorsa-auth-failed" };
  }
  if (info.status >= 400) {
    throw { status: 502, message: "sorsa-info-error", detail: info.body?.message };
  }

  const profile = shapeResult(info.body);

  // 3) cache
  try {
    upsert.run(username, JSON.stringify(profile));
  } catch (e) {
    console.error("[mediakit-api] cache upsert failed:", e);
  }

  return { profile, cached: false, age_ms: 0 };
}

/** Passthrough for the /api/x/usage admin endpoint. */
export async function getSorsaUsage(apiKey) {
  if (!apiKey) throw { status: 503, message: "sorsa-not-configured" };
  const res = await sorsaFetch("/key-usage-info", apiKey);
  if (res.status >= 400) throw { status: 502, message: "sorsa-usage-error", detail: res.body?.message };
  return res.body;
}
