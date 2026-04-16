// Tiny counter API for the Media Kit Generator.
// - POST /api/count   → bump the counter, return {total}
// - GET  /api/stats   → private analytics (requires STATS_KEY)
// - GET  /api/health  → liveness probe
//
// Listens only on 127.0.0.1. Nginx proxies /api/* here.
// State lives in a single SQLite file (one row per kit, timestamp only — no PII).

import express from "express";
import rateLimit from "express-rate-limit";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3101);
const STATS_KEY = process.env.STATS_KEY || "";
const DB_PATH =
  process.env.DATABASE_PATH ||
  path.join(__dirname, "..", "data", "mediakit.db");

if (!STATS_KEY) {
  console.warn(
    "[mediakit-api] WARNING: STATS_KEY not set — /api/stats will reject all requests until you set one.",
  );
}

// Ensure data dir exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS kits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const qInsert    = db.prepare("INSERT INTO kits DEFAULT VALUES");
const qTotal     = db.prepare("SELECT COUNT(*) AS n FROM kits");
const qSince     = db.prepare("SELECT COUNT(*) AS n FROM kits WHERE created_at >= datetime('now', ?)");
const qFirst     = db.prepare("SELECT MIN(created_at) AS t FROM kits");
const qLast      = db.prepare("SELECT MAX(created_at) AS t FROM kits");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback"); // Nginx sits in front

// Light rate-limit on the bump endpoint: 60/min/IP is plenty for real users,
// stops accidental loops and small bots.
const bumpLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "mediakit-api", time: new Date().toISOString() });
});

app.post("/api/count", bumpLimiter, (_req, res) => {
  try {
    qInsert.run();
    const { n } = qTotal.get();
    res.json({ total: n });
  } catch (err) {
    console.error("[mediakit-api] count error:", err);
    res.status(500).json({ error: "internal" });
  }
});

app.get("/api/stats", (req, res) => {
  const provided = String(req.query.key ?? "");
  if (!STATS_KEY) return res.status(503).json({ error: "stats-key-not-configured" });

  const a = Buffer.from(provided);
  const b = Buffer.from(STATS_KEY);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  res.json({
    total:        qTotal.get().n,
    today:        qSince.get("-1 day").n,
    last_7_days:  qSince.get("-7 days").n,
    last_30_days: qSince.get("-30 days").n,
    first_kit_at: qFirst.get().t,
    last_kit_at:  qLast.get().t,
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[mediakit-api] listening on 127.0.0.1:${PORT}  (db=${DB_PATH})`);
});

// Clean shutdown
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[mediakit-api] received ${sig}, closing`);
    db.close();
    process.exit(0);
  });
}
