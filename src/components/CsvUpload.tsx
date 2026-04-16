import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { parseXAnalyticsCsv, formatDateRange, type XAnalyticsStats } from "@/lib/csvAnalytics";

const BRAND = "#1800ad";
const TINT = "#cde2f5";

export interface CsvUploadProps {
  /** Called when a valid X analytics CSV has been parsed. */
  onParsed: (stats: XAnalyticsStats) => void;
}

type UiState =
  | { kind: "idle" }
  | { kind: "parsing" }
  | { kind: "loaded"; stats: XAnalyticsStats; fileName: string }
  | { kind: "error"; message: string };

export default function CsvUpload({ onParsed }: CsvUploadProps) {
  const [state, setState] = useState<UiState>({ kind: "idle" });
  const [showHelp, setShowHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return;
      if (!/\.csv$/i.test(file.name) && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel") {
        setState({ kind: "error", message: "That doesn't look like a CSV file. Please upload the .csv export from X." });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setState({ kind: "error", message: "File is larger than 5 MB — this doesn't look like an X analytics export." });
        return;
      }
      setState({ kind: "parsing" });
      try {
        const text = await file.text();
        const stats = parseXAnalyticsCsv(text);
        if (!stats) {
          setState({
            kind: "error",
            message: "We couldn't recognize this CSV. Make sure it's the Account Overview export from X (with columns like Impressions, Engagements, Likes).",
          });
          return;
        }
        setState({ kind: "loaded", stats, fileName: file.name });
        onParsed(stats);
      } catch {
        setState({ kind: "error", message: "Something went wrong reading that file. Try again?" });
      }
    },
    [onParsed],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-uploaded if desired
      e.target.value = "";
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const reset = useCallback(() => {
    setState({ kind: "idle" });
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold tracking-widest uppercase" style={{ color: BRAND, opacity: 0.5 }}>
          Your X Analytics <span style={{ opacity: 0.5, fontWeight: 300, textTransform: "lowercase", letterSpacing: "0.02em" }}>(optional — auto-fills stats)</span>
        </label>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
          style={{ color: BRAND, opacity: 0.6 }}
          aria-expanded={showHelp}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          How to get it
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showHelp && (
          <motion.div
            key="help"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl px-5 py-4 text-sm"
              style={{ background: TINT, color: BRAND, fontWeight: 300 }}
            >
              <ol className="flex flex-col gap-2 list-none pl-0">
                <HelpStep n={1} text="Open " link={{ label: "analytics.x.com", href: "https://analytics.x.com/" }} tail=" and sign in" />
                <HelpStep n={2} text="Click “Account overview” in the left sidebar" />
                <HelpStep n={3} text="Set the date range (90 days works best)" />
                <HelpStep n={4} text="Click the “Export data” button in the top-right" />
                <HelpStep n={5} text="Drop the downloaded .csv file below" />
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {state.kind === "loaded" ? (
          <motion.div
            key="loaded"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl p-4 sm:p-5"
            style={{ background: TINT, color: BRAND }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">CSV loaded — stats auto-filled below</span>
                  <span className="text-xs" style={{ opacity: 0.6, fontWeight: 300 }}>
                    {formatDateRange(state.stats.meta)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="text-xs font-bold uppercase tracking-wider underline"
                style={{ color: BRAND, opacity: 0.6 }}
              >
                replace
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Impressions"  value={formatInt(state.stats.totals.impressions)} />
              <Metric label="Engagements"  value={formatInt(state.stats.totals.engagements)} />
              <Metric label="Eng. rate"    value={state.stats.engagementRate.toFixed(2) + "%"} />
              <Metric label="Net followers" value={formatSigned(state.stats.netFollowerChange)} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="drop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              onChange={onInputChange}
              className="hidden"
              aria-label="Upload X analytics CSV"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className="w-full flex flex-row items-center justify-center gap-2.5 rounded-full py-3 px-5 transition-all focus:outline-none"
              style={{
                background: isDragging ? "#b8d4ee" : TINT,
                border: `1.5px dashed ${BRAND}${isDragging ? "66" : "33"}`,
                color: BRAND,
                cursor: "pointer",
              }}
            >
              {state.kind === "parsing" ? (
                <>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span className="text-sm font-bold">Reading your file…</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="text-sm font-bold whitespace-nowrap">
                    {isDragging ? "Drop to upload" : "Drop CSV"}
                  </span>
                  <span className="text-xs hidden sm:inline" style={{ opacity: 0.55, fontWeight: 300 }}>
                    or click to browse
                  </span>
                </>
              )}
            </button>
            {state.kind === "error" && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs mt-2 text-center"
                style={{ color: "#e03" }}
              >
                {state.message}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HelpStep({
  n, text, link, tail,
}: { n: number; text: string; link?: { label: string; href: string }; tail?: string }) {
  return (
    <li className="flex items-start gap-2.5 leading-snug">
      <span
        className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-[10px] font-bold"
        style={{ width: 18, height: 18, background: BRAND, color: "#fff" }}
      >
        {n}
      </span>
      <span>
        {text}
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-bold"
            style={{ color: BRAND }}
          >
            {link.label}
          </a>
        )}
        {tail ?? ""}
      </span>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ opacity: 0.55 }}>
        {label}
      </span>
      <span className="text-base sm:text-lg font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
function formatSigned(n: number): string {
  const rounded = Math.round(n);
  return rounded > 0 ? `+${formatInt(rounded)}` : formatInt(rounded);
}
