// Media Kit Generator API.
//
//   POST /api/count       → log a kit generation, return {total}
//                           Optional JSON body: {username, display_name, followers}
//   GET  /api/stats       → private analytics (requires STATS_KEY via ?key=)
//   GET  /api/health      → liveness
//   GET  /api/x/profile   → fetch + cache an X profile (via Sorsa /info)
//   GET  /api/x/usage     → Sorsa credit usage passthrough (requires STATS_KEY)
//
// Listens only on 127.0.0.1. Nginx proxies /api/* here.
// State lives in a single SQLite file:
//   - kits              (one row per generated kit + optional metadata)
//   - x_profile_cache   (24h cache of Sorsa /info lookups)

import express from "express";
import rateLimit from "express-rate-limit";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { getXProfile, getSorsaUsage, normalizeHandle } from "./xProfile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3101);
const STATS_KEY = process.env.STATS_KEY || "";
const SORSA_API_KEY = process.env.SORSA_API_KEY || "";
const DB_PATH =
  process.env.DATABASE_PATH ||
  path.join(__dirname, "..", "data", "mediakit.db");

if (!STATS_KEY) {
  console.warn(
    "[mediakit-api] WARNING: STATS_KEY not set — /api/stats will reject all requests until you set one.",
  );
}
if (!SORSA_API_KEY) {
  console.warn(
    "[mediakit-api] WARNING: SORSA_API_KEY not set — /api/x/profile will return 503 until you set one.",
  );
}

// Ensure data dir exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// --- schema ----------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS kits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    username TEXT,
    display_name TEXT,
    followers INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_kits_username ON kits(username);

  CREATE TABLE IF NOT EXISTS x_profile_cache (
    username TEXT PRIMARY KEY,
    data_json TEXT NOT NULL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Idempotent column migration in case the db was created by an older version
// of this service (pre-metadata columns)
const existingKitCols = new Set(
  db.prepare("PRAGMA table_info(kits)").all().map((r) => r.name),
);
const needed = [
  ["username", "TEXT"],
  ["display_name", "TEXT"],
  ["followers", "INTEGER"],
];
for (const [col, type] of needed) {
  if (!existingKitCols.has(col)) {
    db.exec(`ALTER TABLE kits ADD COLUMN ${col} ${type}`);
    console.log(`[mediakit-api] migrated: added kits.${col}`);
  }
}

// --- prepared statements ---------------------------------------------------
const qInsertKit = db.prepare(
  "INSERT INTO kits (username, display_name, followers) VALUES (?, ?, ?)",
);
const qTotal     = db.prepare("SELECT COUNT(*) AS n FROM kits");
const qSince     = db.prepare(
  "SELECT COUNT(*) AS n FROM kits WHERE created_at >= datetime('now', ?)",
);
const qUnique    = db.prepare(
  "SELECT COUNT(DISTINCT username) AS n FROM kits WHERE username IS NOT NULL AND username != ''",
);
const qTop       = db.prepare(`
  SELECT username, MAX(display_name) AS display_name, COUNT(*) AS kit_count,
         MAX(followers) AS followers, MAX(created_at) AS last_at
    FROM kits
   WHERE username IS NOT NULL AND username != ''
GROUP BY username
ORDER BY kit_count DESC, last_at DESC
   LIMIT 10
`);
const qFirst     = db.prepare("SELECT MIN(created_at) AS t FROM kits");
const qLast      = db.prepare("SELECT MAX(created_at) AS t FROM kits");

// --- app -------------------------------------------------------------------
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");

const bumpLimiter = rateLimit({
  windowMs: 60_000, limit: 60,
  standardHeaders: "draft-7", legacyHeaders: false,
});
// Tighter limit on the Sorsa-backed lookup because each fresh one burns a credit.
// 10/min/IP covers real users; blocks anyone trying to burn through your balance.
const xProfileLimiter = rateLimit({
  windowMs: 60_000, limit: 10,
  standardHeaders: "draft-7", legacyHeaders: false,
});

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
function requireStatsKey(req, res) {
  if (!STATS_KEY) { res.status(503).json({ error: "stats-key-not-configured" }); return false; }
  const provided = String(req.query.key ?? "");
  if (!timingSafeEqualStr(provided, STATS_KEY)) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

// --- routes ----------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "mediakit-api", time: new Date().toISOString() });
});

// Accept optional JSON body with kit-generation metadata. JSON parser is scoped
// to this route only so no global middleware overhead.
app.post("/api/count", bumpLimiter, express.json({ limit: "4kb" }), (req, res) => {
  try {
    const body = req.body ?? {};
    const username     = typeof body.username     === "string" ? normalizeHandle(body.username).slice(0, 30)  : null;
    const displayName  = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 80)        : null;
    const followersRaw = body.followers;
    const followers    = Number.isFinite(followersRaw) ? Math.max(0, Math.floor(followersRaw)) : null;

    qInsertKit.run(username, displayName, followers);
    const { n } = qTotal.get();
    res.json({ total: n });
  } catch (err) {
    console.error("[mediakit-api] count error:", err);
    res.status(500).json({ error: "internal" });
  }
});

app.get("/api/stats", (req, res) => {
  if (!requireStatsKey(req, res)) return;
  res.json({
    total:         qTotal.get().n,
    today:         qSince.get("-1 day").n,
    last_7_days:   qSince.get("-7 days").n,
    last_30_days:  qSince.get("-30 days").n,
    unique_users:  qUnique.get().n,
    top_users:     qTop.all(),
    first_kit_at:  qFirst.get().t,
    last_kit_at:   qLast.get().t,
  });
});

// Fetch (or return cached) X profile — the "Fetch from X" button behind it
app.get("/api/x/profile", xProfileLimiter, async (req, res) => {
  try {
    const result = await getXProfile(db, req.query.username, { apiKey: SORSA_API_KEY });
    res.set("Cache-Control", "no-store");
    res.json(result);
  } catch (err) {
    if (err && typeof err.status === "number") {
      return res.status(err.status).json({ error: err.message, detail: err.detail });
    }
    console.error("[mediakit-api] x/profile error:", err);
    res.status(500).json({ error: "internal" });
  }
});

// Private: current Sorsa credit balance
app.get("/api/x/usage", async (req, res) => {
  if (!requireStatsKey(req, res)) return;
  try {
    const usage = await getSorsaUsage(SORSA_API_KEY);
    res.set("Cache-Control", "no-store");
    res.json(usage);
  } catch (err) {
    if (err && typeof err.status === "number") {
      return res.status(err.status).json({ error: err.message, detail: err.detail });
    }
    console.error("[mediakit-api] x/usage error:", err);
    res.status(500).json({ error: "internal" });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[mediakit-api] listening on 127.0.0.1:${PORT}  (db=${DB_PATH})`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[mediakit-api] received ${sig}, closing`);
    db.close();
    process.exit(0);
  });
}
