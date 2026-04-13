import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import type { MediaKitData, SocialPlatform } from "@/lib/mediaKit";
import { formatFollowers, formatNumber, getTotalFollowers, PLATFORM_LABELS, PLATFORM_ICONS, NICHE_TAGS } from "@/lib/mediaKit";

export type CardTheme = "dark" | "light";

// Card dimensions (16:9 landscape for X post)
const CARD_W = 1200;
const CARD_H = 800;

// Default 3-color palette
const C1 = "#0f0f0f";
const C2 = "#CDE2F5";
const C3 = "#EFF0FF";
const C1_LIGHT = "#2200c8";
const TEXT_ON_DARK = "#ffffff";
const TEXT_ON_LIGHT = "#1800ad";

// Parse hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}
// Derive a full palette from any bg color
function derivePalette(bg: string) {
  const dark = isDark(bg);
  const [r, g, b] = hexToRgb(bg);
  if (dark) {
    // Lighten the bg for panel variant
    const panelR = Math.min(255, r + 30), panelG = Math.min(255, g + 30), panelB = Math.min(255, b + 30);

    // Brand blue override — use exact user-specified colors
    const isBrandBlue = r < 40 && g < 20 && b > 150;
    if (isBrandBlue) {
      return {
        bg,
        panel: rgbToHex(panelR, panelG, panelB),
        tint: "#CDE2F5",
        frost: "#EFF0FF",
        textPrimary: "#ffffff",
        textOnTint: "#1F07B7",
        asciiColor: "rgba(255,255,255,0.08)",
        glowColor: `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 80)},0.2)`,
        tagBg: "#CDE2F5",
        tagText: "#1F07B7",
        dark: true,
        brandBlue: true,
      };
    }

    // Create a light tint for metric boxes and headers
    const tintR = Math.min(255, r + 160), tintG = Math.min(255, g + 160), tintB = Math.min(255, b + 160);
    const frostR = Math.min(255, r + 190), frostG = Math.min(255, g + 190), frostB = Math.min(255, b + 190);
    return {
      bg,
      panel: rgbToHex(panelR, panelG, panelB),
      tint: rgbToHex(tintR, tintG, tintB),
      frost: rgbToHex(frostR, frostG, frostB),
      textPrimary: "#ffffff",
      textOnTint: bg,
      asciiColor: "rgba(255,255,255,0.08)",
      glowColor: `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 80)},0.2)`,
      tagBg: rgbToHex(tintR, tintG, tintB),
      tagText: bg,
      dark: true,
    };
  } else {
    // Dark variant for panels on light backgrounds
    const panelR = Math.max(0, r - 20), panelG = Math.max(0, g - 20), panelB = Math.max(0, b - 20);
    const darkR = Math.max(0, r - 160), darkG = Math.max(0, g - 160), darkB = Math.max(0, b - 160);
    const darkHex = rgbToHex(darkR, darkG, darkB);
    return {
      bg,
      panel: rgbToHex(panelR, panelG, panelB),
      tint: darkHex,
      frost: rgbToHex(Math.max(0, r - 10), Math.max(0, g - 10), Math.max(0, b - 10)),
      textPrimary: "#000000",
      textOnTint: "#000000",
      asciiColor: `rgba(${darkR},${darkG},${darkB},0.06)`,
      glowColor: `rgba(${darkR},${darkG},${darkB},0.08)`,
      tagBg: darkHex,
      tagText: "#ffffff",
      dark: false,
    };
  }
}

// ASCII orb — a circular cluster of denser characters in the center
function generateAsciiOrb(color: string, w: number, h: number, seed: number = 77): string {
  const chars = "@#S%08Xox+=;:-,.";
  const cols = Math.floor(w / 8);
  const rows = Math.floor(h / 14);
  const cx = cols / 2, cy = rows / 2;
  const maxR = Math.min(cols, rows) * 0.45;
  let text = "";
  let rng = seed;
  const next = () => { rng = (rng * 16807 + 0) % 2147483647; return rng / 2147483647; };

  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      const dx = c - cx, dy = (r - cy) * 1.6;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const norm = dist / maxR;
      // Denser in center, sparser at edges
      const density = norm < 1 ? 0.6 * Math.pow(1 - norm, 1.5) : 0.02;
      if (next() < density) {
        const charIdx = Math.floor(norm * (chars.length - 1));
        line += chars[Math.min(charIdx, chars.length - 1)];
      } else {
        next();
        line += " ";
      }
    }
    text += `<tspan x="0" dy="${r === 0 ? 0 : 22}">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</tspan>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * 13}" height="${rows * 22}">
    <text font-family="monospace" font-size="20" fill="${color}" font-weight="bold">${text}</text>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Generate ASCII background pattern as an SVG data URL
function generateAsciiPattern(color: string, seed: number = 42): string {
  const chars = "@#S08Xox+=;:-,.";
  const cols = 60;
  const rows = 24;
  let text = "";
  let rng = seed;
  const next = () => { rng = (rng * 16807 + 0) % 2147483647; return rng / 2147483647; };

  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      line += next() < 0.4 ? chars[Math.floor(next() * chars.length)] : " ";
    }
    text += `<tspan x="0" dy="${r === 0 ? 0 : 22}">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</tspan>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * 13}" height="${rows * 22}">
    <text font-family="monospace" font-size="20" fill="${color}" font-weight="bold">${text}</text>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function PlatformIcon({ platform, color, size = 14 }: { platform: SocialPlatform["platform"]; color: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0 }} fill={color}>
      <path d={PLATFORM_ICONS[platform]} />
    </svg>
  );
}

interface MediaKitCardProps {
  data: MediaKitData;
  cardRef?: React.RefObject<HTMLDivElement>;
  theme?: CardTheme;
  bgColor?: string;
}

export default function MediaKitCard({ data, cardRef, bgColor }: MediaKitCardProps) {
  const initials = data.displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const xSocial = data.socials.find(s => s.platform === "twitter" && s.handle);
  const nicheTags = Array.isArray(data.niche)
    ? data.niche.flatMap(n => NICHE_TAGS[n] || [n]).slice(0, 6)
    : NICHE_TAGS[data.niche as any] || (data.niche ? [data.niche] : []);
  const p = derivePalette(bgColor || C1);
  const asciiPattern = generateAsciiPattern(p.dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.18)", 42);
  const asciiOrb = generateAsciiOrb(p.dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.18)", 600, 500, 77);

  const borderCol = p.dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)";
  const isBrand = !!(p as any).brandBlue;
  const dimText = isBrand ? "rgba(31,7,183,0.5)" : (p.dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)");
  const cardTextPrimary = isBrand ? "#1F07B7" : p.textPrimary;

  // Glass styles — semi-transparent with blur so ASCII shows through
  const [bgR, bgG, bgB] = hexToRgb(p.bg);
  const [tintR, tintG, tintB] = hexToRgb(p.tint);
  const [frostR, frostG, frostB] = hexToRgb(p.frost);
  const [panelR, panelG, panelB] = hexToRgb(p.panel);

  // Liquid glass — uses palette tint/frost colors with transparency
  const blurStyle = "blur(20px) saturate(1.3)";
  const glassBase = isBrand
    ? "#CDE2F5"
    : p.dark ? `rgba(255,255,255,0.08)` : `rgba(0,0,0,0.08)`;
  const glassLighter = isBrand
    ? "#CDE2F5"
    : p.dark ? `rgba(255,255,255,0.12)` : `rgba(0,0,0,0.06)`;
  const glassTint = { background: glassBase, backdropFilter: isBrand ? "none" : blurStyle, WebkitBackdropFilter: isBrand ? "none" : blurStyle, border: "none" } as React.CSSProperties;
  const glassFrost = { background: glassLighter, backdropFilter: isBrand ? "none" : blurStyle, WebkitBackdropFilter: isBrand ? "none" : blurStyle, border: "none" } as React.CSSProperties;
  const glassPanel = { background: glassBase, backdropFilter: isBrand ? "none" : blurStyle, WebkitBackdropFilter: isBrand ? "none" : blurStyle, border: "none" } as React.CSSProperties;
  const glassTag = { background: isBrand ? "#CDE2F5" : (p.dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)"), backdropFilter: isBrand ? "none" : blurStyle, WebkitBackdropFilter: isBrand ? "none" : blurStyle, border: "none" } as React.CSSProperties;

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden flex flex-col mediakit-card"
      style={{
        background: p.bg,
        fontFamily: "'Neue Haas Unica', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        width: `${CARD_W}px`,
        height: `${CARD_H}px`,
        flexShrink: 0,
        borderRadius: "20px",
        padding: "18px",
        gap: "12px",
      }}
    >
      {/* ASCII texture background */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: asciiPattern, backgroundRepeat: "repeat" }} />
      {/* ASCII orb element — positioned right-center */}
      <div className="absolute pointer-events-none" style={{
        backgroundImage: asciiOrb, backgroundRepeat: "no-repeat", backgroundPosition: "center",
        width: "600px", height: "500px", right: "-40px", top: "50%", transform: "translateY(-50%)",
        opacity: 0.9,
      }} />
      {/* Radial glow */}
      <div className="absolute pointer-events-none" style={{
        width: "700px", height: "700px", top: "50%", left: "30%", transform: "translate(-50%, -50%)",
        background: `radial-gradient(ellipse, ${p.glowColor} 0%, transparent 70%)`, borderRadius: "50%",
      }} />

      {/* TITLE BANNER */}
      <div style={{
        position: "relative", zIndex: 1, borderRadius: "14px", padding: "20px 28px",
        ...glassTint, overflow: "hidden",
      }}>
        <h1 style={{
          color: isBrand ? "#1F07B7" : (p.dark ? "#ffffff" : p.textOnTint),
          fontFamily: "'Neue Haas Unica', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: "52px",
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          margin: 0,
          textAlign: "center",
        }}>
          {data.displayName.toUpperCase()}'S MEDIAKIT
        </h1>
      </div>

      {/* MAIN — two columns */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flex: 1, gap: "12px", minHeight: 0 }}>

        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", width: "48%", gap: "10px" }}>
          {/* Handle bar */}
          <div style={{ borderRadius: "12px", padding: "10px 18px", ...glassFrost }}>
            <span style={{ color: (p as any).brandBlue ? "#1F07B7" : (p.dark ? "#ffffff" : p.textPrimary), fontSize: "20px", fontWeight: 700 }}>
              @{xSocial?.handle || data.displayName.toLowerCase().replace(/\s/g, "")}
            </span>
          </div>

          {/* Niche tags — above photo/bio */}
          {nicheTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {nicheTags.map(tag => (
                <span key={tag} style={{
                  ...glassTag, color: (p as any).brandBlue ? "#1F07B7" : (p.dark ? "#ffffff" : "#000000"), fontSize: "14px", fontWeight: 700,
                  padding: "8px 16px", borderRadius: "10px",
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Photo + About — square boxes, fill width */}
          <div style={{ display: "flex", gap: "10px" }}>
            {/* Profile Photo — SQUARE */}
            <div style={{
              flex: 1, aspectRatio: "1", borderRadius: "12px", overflow: "hidden",
              background: p.tint, position: "relative",
            }}>
              {data.profileImageUrl ? (
                <img src={data.profileImageUrl} alt={data.displayName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div style={{
                  width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: p.panel, color: p.tint, fontSize: "56px", fontWeight: 700,
                }}>
                  {initials}
                </div>
              )}
            </div>

            {/* About — SQUARE, same size as photo */}
            <div style={{
              ...glassPanel, borderRadius: "12px", padding: "14px 16px",
              flex: 1, aspectRatio: "1", display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              <span style={{ color: dimText, fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>about:</span>
              <p style={{ color: cardTextPrimary, fontSize: "19px", lineHeight: 1.5, fontWeight: 400, flex: 1 }}>
                {data.bio || "Crypto content creator & community builder."}
              </p>
            </div>
          </div>

          {/* Contact row */}
          {data.email && (
            <div style={{
              ...glassPanel, borderRadius: "10px", padding: "10px 18px",
            }}>
              <span style={{ color: dimText, fontSize: "12px", fontWeight: 700 }}>email: </span>
              <span style={{ color: cardTextPrimary, fontSize: "14px", fontWeight: 300 }}>{data.email}</span>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", width: "52%", gap: "10px" }}>
          {/* X Metrics header */}
          <div style={{ ...glassFrost, borderRadius: "12px", padding: "10px 18px", textAlign: "center" }}>
            <span style={{ color: (p as any).brandBlue ? "#1F07B7" : (p.dark ? "#ffffff" : p.textPrimary), fontSize: "20px", fontWeight: 700 }}>X Metrics</span>
          </div>

          {/* 2x2 metrics — BIG */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", flex: 1 }}>
            <MetricBox value={xSocial ? formatNumber(xSocial.followers) : "\u2014"} label="followers" p={p} />
            <MetricBox value={data.impressions ? formatFollowers(data.impressions) : "\u2014"} label="impressions" sublabel="( 90 days )" p={p} />
            <MetricBox value={data.engagementRate ? `${data.engagementRate}%` : "\u2014"} label="engagement rate" p={p} />
            <MetricBox value={data.engagements ? formatFollowers(data.engagements) : "\u2014"} label="engagements" sublabel="( 90 days )" p={p} />
          </div>

          {/* Proposed Deal — only shown if user filled in deal or price */}
          {(data.proposedDeal || data.dealPrice) && (
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{
                ...glassFrost, borderRadius: "10px", padding: "14px 20px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: (p as any).brandBlue ? "#1F07B7" : (p.dark ? "#ffffff" : p.textPrimary), fontSize: "14px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Proposed Deal</span>
              </div>
              <div style={{
                ...glassFrost, borderRadius: "10px", padding: "14px 20px", flex: 1,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <p style={{ color: (p as any).brandBlue ? "#1F07B7" : (p.dark ? "#ffffff" : p.textPrimary), fontSize: "16px", fontWeight: 700, lineHeight: 1.3, flex: 1, marginRight: "12px" }}>
                  {data.proposedDeal || "Custom deal"}
                </p>
                <span style={{ color: (p as any).brandBlue ? "#1F07B7" : (p.dark ? "#ffffff" : p.textPrimary), fontSize: "26px", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {data.dealPrice ? `$${data.dealPrice}` : ""}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricBox({ value, label, sublabel, p }: { value: string; label: string; sublabel?: string; p: ReturnType<typeof derivePalette> }) {
  const isBrand = !!(p as any).brandBlue;
  const bgStyle = isBrand ? "#CDE2F5" : (p.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)");
  const textCol = isBrand ? "#1F07B7" : (p.dark ? "#ffffff" : "#000000");
  const blur = isBrand ? "none" : "blur(20px) saturate(1.3)";
  return (
    <div style={{
      background: bgStyle,
      backdropFilter: blur, WebkitBackdropFilter: blur,
      borderRadius: "14px", padding: "18px 20px", border: "none",
      display: "flex", flexDirection: "column", justifyContent: "center",
    }}>
      <span style={{ color: textCol, fontSize: "56px", fontWeight: 700, lineHeight: 1 }}>{value}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px" }}>
        <span style={{ color: textCol, fontSize: "20px", fontWeight: 400, opacity: 0.85 }}>{label}</span>
        {sublabel && <span style={{ color: textCol, fontSize: "16px", fontWeight: 300, opacity: 0.6 }}>{sublabel}</span>}
      </div>
    </div>
  );
}

// Animated wrapper
export function MediaKitCardAnimated({ data, cardRef, theme = "dark", bgColor }: { data: MediaKitData; cardRef?: React.RefObject<HTMLDivElement>; theme?: CardTheme; bgColor?: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setScale(entry.contentRect.width / CARD_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{ width: "100%" }}
    >
      <div ref={wrapperRef} style={{ width: "100%", aspectRatio: `${CARD_W} / ${CARD_H}`, position: "relative", overflow: "hidden", borderRadius: "1.25rem" }}>
        <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "top left", transform: `scale(${scale})` }}>
          <MediaKitCard data={data} cardRef={cardRef} theme={theme} bgColor={bgColor} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Direct capture — captures the live card element with sharp corners ───
export async function renderMediaKitFromRef(
  cardRef: React.RefObject<HTMLDivElement>,
): Promise<string> {
  const cardEl = cardRef.current;
  if (!cardEl) throw new Error("Card ref not available");

  // Temporarily remove border-radius for sharp export edges
  const savedRadius = cardEl.style.borderRadius;
  cardEl.style.borderRadius = "0";

  try {
    // Warmup pass — first call can miss fonts/images
    await toPng(cardEl, { width: CARD_W, height: CARD_H, pixelRatio: 1, cacheBust: true });

    // Full quality pass
    const dataUrl = await toPng(cardEl, {
      width: CARD_W,
      height: CARD_H,
      pixelRatio: 2,
      cacheBust: true,
    });

    return dataUrl;
  } finally {
    // Restore border-radius
    cardEl.style.borderRadius = savedRadius;
  }
}
