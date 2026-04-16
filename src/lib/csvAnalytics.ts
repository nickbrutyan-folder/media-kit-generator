/**
 * Parses the CSV that X (Twitter) exports from:
 *   Analytics → Account overview → Export
 *
 * File looks like:
 *   Date,Impressions,Likes,Engagements,Bookmarks,Shares,New follows,Unfollows,Replies,Reposts,Profile visits,Create Post,Video views,Media views
 *   "Thu, Apr 16, 2026",25,0,1,0,0,0,0,0,0,0,0,0,0
 *
 * The Date column contains commas inside quotes, so we need a proper RFC-4180
 * style parser (no regex/split shortcuts).
 */

export interface XAnalyticsStats {
  // Raw totals over the whole export window
  totals: {
    impressions: number;
    likes: number;
    engagements: number;
    bookmarks: number;
    shares: number;
    newFollows: number;
    unfollows: number;
    replies: number;
    reposts: number;
    profileVisits: number;
    posts: number;
    videoViews: number;
    mediaViews: number;
  };
  // Per-day averages for the narrative fields
  averages: {
    likesPerDay: number;
    repliesPerDay: number;
  };
  // Calculated rate: engagements / impressions × 100
  engagementRate: number;
  // Net followers gained over the window (newFollows - unfollows)
  netFollowerChange: number;
  // Window metadata
  meta: {
    startDate: string;   // ISO yyyy-mm-dd of earliest row
    endDate: string;     // ISO yyyy-mm-dd of latest row
    days: number;        // number of non-empty rows parsed
  };
}

/** Minimal RFC-4180 CSV parser: handles quoted fields with embedded commas + "" escapes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  // Normalize line endings so \r\n and \r both become \n
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  // Flush trailing partial row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Parse "Thu, Apr 16, 2026" → "2026-04-16". Returns null on unrecognized format. */
function parseXDate(input: string): string | null {
  const s = input.trim().replace(/^"|"$/g, "");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toInt(v: string): number {
  const n = parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

const REQUIRED_COLUMNS = [
  "Date",
  "Impressions",
  "Likes",
  "Engagements",
  "Replies",
  "New follows",
  "Unfollows",
];

/**
 * Parse an X account-overview CSV export into computed stats.
 * Returns null if the file doesn't look like an X analytics CSV.
 */
export function parseXAnalyticsCsv(text: string): XAnalyticsStats | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;

  const header = rows[0].map((h) => h.trim());
  // Validate this actually looks like X's format
  for (const required of REQUIRED_COLUMNS) {
    if (!header.includes(required)) return null;
  }

  const idx = (name: string) => header.indexOf(name);

  const col = {
    date:          idx("Date"),
    impressions:   idx("Impressions"),
    likes:         idx("Likes"),
    engagements:   idx("Engagements"),
    bookmarks:     idx("Bookmarks"),
    shares:        idx("Shares"),
    newFollows:    idx("New follows"),
    unfollows:     idx("Unfollows"),
    replies:       idx("Replies"),
    reposts:       idx("Reposts"),
    profileVisits: idx("Profile visits"),
    posts:         idx("Create Post"),
    videoViews:    idx("Video views"),
    mediaViews:    idx("Media views"),
  };

  const totals = {
    impressions: 0, likes: 0, engagements: 0, bookmarks: 0, shares: 0,
    newFollows: 0, unfollows: 0, replies: 0, reposts: 0, profileVisits: 0,
    posts: 0, videoViews: 0, mediaViews: 0,
  };

  const dates: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < header.length - 1) continue; // skip incomplete rows
    const iso = parseXDate(row[col.date] ?? "");
    if (iso) dates.push(iso);

    totals.impressions   += toInt(row[col.impressions]);
    totals.likes         += toInt(row[col.likes]);
    totals.engagements   += toInt(row[col.engagements]);
    totals.bookmarks     += col.bookmarks     >= 0 ? toInt(row[col.bookmarks])     : 0;
    totals.shares        += col.shares        >= 0 ? toInt(row[col.shares])        : 0;
    totals.newFollows    += toInt(row[col.newFollows]);
    totals.unfollows     += toInt(row[col.unfollows]);
    totals.replies       += toInt(row[col.replies]);
    totals.reposts       += col.reposts       >= 0 ? toInt(row[col.reposts])       : 0;
    totals.profileVisits += col.profileVisits >= 0 ? toInt(row[col.profileVisits]) : 0;
    totals.posts         += col.posts         >= 0 ? toInt(row[col.posts])         : 0;
    totals.videoViews    += col.videoViews    >= 0 ? toInt(row[col.videoViews])    : 0;
    totals.mediaViews    += col.mediaViews    >= 0 ? toInt(row[col.mediaViews])    : 0;
  }

  const days = dates.length;
  if (days === 0) return null;

  dates.sort();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const engagementRate =
    totals.impressions > 0 ? (totals.engagements / totals.impressions) * 100 : 0;

  return {
    totals,
    averages: {
      likesPerDay:   days > 0 ? totals.likes   / days : 0,
      repliesPerDay: days > 0 ? totals.replies / days : 0,
    },
    engagementRate,
    netFollowerChange: totals.newFollows - totals.unfollows,
    meta: { startDate, endDate, days },
  };
}

/** "Mar 20 – Apr 16, 2026 (28 days)" — friendly display of the window. */
export function formatDateRange(meta: XAnalyticsStats["meta"]): string {
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const fmtFull: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

  // Use UTC so we don't shift dates via the viewer's local tz
  const start = new Date(meta.startDate + "T00:00:00Z");
  const end = new Date(meta.endDate + "T00:00:00Z");

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();

  const formatter = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(d);

  const startStr = formatter(start, sameYear ? fmt : fmtFull);
  const endStr = formatter(end, fmtFull);

  return `${startStr} – ${endStr} (${meta.days} day${meta.days === 1 ? "" : "s"})`;
}
