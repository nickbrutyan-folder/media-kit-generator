import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MediaKitData, SocialPlatform } from "@/lib/mediaKit";
import { NICHE_OPTIONS, PLATFORM_LABELS, PLATFORM_ICONS } from "@/lib/mediaKit";
import { MediaKitCardAnimated, renderMediaKitFromRef, type CardTheme } from "@/components/MediaKitCard";
import BluOrbBackground from "@/components/BluOrbBackground";
import CsvUpload from "@/components/CsvUpload";
import type { XAnalyticsStats } from "@/lib/csvAnalytics";

type Stage = "form" | "loading" | "result";

const BRAND = "#1800ad";

const EMPTY_SOCIAL = (platform: SocialPlatform["platform"]): SocialPlatform => ({
  platform,
  handle: "",
  followers: "",
});

const DEFAULT_DATA: MediaKitData = {
  displayName: "",
  bio: "",
  niche: [],
  email: "",
  profileImageUrl: "",
  socials: [
    EMPTY_SOCIAL("twitter"),
  ],
  engagementRate: "",
  avgLikes: "",
  avgComments: "",
  impressions: "",
  engagements: "",
  proposedDeal: "",
  dealPrice: "",
};

/** Extract X handle from a URL or raw input like @handle, x.com/handle, https://twitter.com/handle */
function parseXHandle(input: string): string {
  const trimmed = input.trim();
  // Strip URL patterns
  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/(@?\w+)/i);
  if (urlMatch) return urlMatch[1].replace(/^@/, "");
  // Strip leading @
  return trimmed.replace(/^@/, "");
}

const inputStyle = {
  background: "#cde2f5",
  border: "none",
  color: BRAND,
  fontFamily: "'Neue Haas Unica', sans-serif",
  fontWeight: 300 as const,
};

function FormInput({ label, value, onChange, placeholder, type = "text", required = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold tracking-widest uppercase" style={{ color: BRAND, opacity: 0.5 }}>
        {label} {required && <span style={{ color: "#e03" }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-0"
        style={inputStyle}
        required={required}
      />
    </div>
  );
}

export default function Index() {
  const [stage, setStage] = useState<Stage>("form");
  const [data, setData] = useState<MediaKitData>(DEFAULT_DATA);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copying" | "done">("idle");
  const [cardTheme, setCardTheme] = useState<CardTheme>("dark");
  const [bgColor, setBgColor] = useState<string>("");
  const cardRef = useRef<HTMLDivElement>(null);
  const pfpTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const COLOR_SWATCHES = [
    { hex: "", label: "Default" },
    { hex: "#1800ad", label: "Brand Blue" },
    { hex: "#0f0f0f", label: "Black" },
    { hex: "#1a1a2e", label: "Navy" },
    { hex: "#0d1b2a", label: "Midnight" },
    { hex: "#493c37", label: "Mocha" },
    { hex: "#ffe5b6", label: "Peach" },
    { hex: "#ff9cf2", label: "Pink" },
    { hex: "#F5EEC0", label: "Cream" },
    { hex: "#eef0ff", label: "Frost" },
  ];
  function updateField<K extends keyof MediaKitData>(key: K, value: MediaKitData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function updateSocial(index: number, field: keyof SocialPlatform, value: string) {
    setData((d) => {
      const socials = [...d.socials];
      socials[index] = { ...socials[index], [field]: value };
      return { ...d, socials };
    });
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const hasSocial = data.socials.some((s) => s.handle.trim());
    if (!hasSocial) {
      setError("Please enter your X handle and click 'fetch profile'");
      return;
    }
    setError("");
    setStage("loading");
    setTimeout(() => {
      setStage("result");
      // Fire-and-forget counter bump. Never blocks the UI; counter is analytics only.
      fetch("/api/count", { method: "POST" }).catch(() => { /* ignore */ });
    }, 2500);
  }

  function handleReset() {
    setStage("form");
  }

  /** Auto-fill the numeric stats fields from a parsed X analytics CSV. */
  function handleAnalyticsParsed(stats: XAnalyticsStats) {
    setData((d) => ({
      ...d,
      impressions:    String(stats.totals.impressions),
      engagements:    String(stats.totals.engagements),
      engagementRate: stats.engagementRate.toFixed(2),
      avgLikes:       stats.averages.likesPerDay.toFixed(1),
      avgComments:    stats.averages.repliesPerDay.toFixed(1),
    }));
  }

  const handleCopyImage = useCallback(async () => {
    if (copyState === "copying") return;
    setCopyState("copying");
    try {
      const dataUrl = await renderMediaKitFromRef(cardRef);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyState("done");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("idle");
    }
  }, [copyState]);

  const handleDownload = useCallback(async () => {
    try {
      const dataUrl = await renderMediaKitFromRef(cardRef);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${data.displayName.replace(/\s+/g, "-").toLowerCase()}-media-kit.png`;
      a.click();
    } catch (e) {
      console.error("Download failed:", e);
    }
  }, [data.displayName]);

  return (
    <div
      className="min-h-screen flex flex-col overflow-y-auto"
      style={{ fontFamily: "'Neue Haas Unica', 'Helvetica Neue', Helvetica, Arial, sans-serif", color: BRAND }}
    >
      <BluOrbBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center px-5 sm:px-8 py-5 sm:py-6">
        <svg className="h-5 sm:h-7" viewBox="0 0 203 35" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="lunar strategy">
          <path d="M50.236 5.064V25H47.044V5.064H50.236ZM57.9574 25.336C56.3148 25.336 55.0361 24.8413 54.1214 23.852C53.2254 22.8627 52.7774 21.4067 52.7774 19.484V10.776H55.9694V19.204C55.9694 21.5747 56.9308 22.76 58.8534 22.76C59.8054 22.76 60.5801 22.4053 61.1774 21.696C61.7934 20.9867 62.1014 19.9787 62.1014 18.672V10.776H65.2934V25H62.2694V23.152H62.2134C61.2054 24.608 59.7868 25.336 57.9574 25.336ZM75.3144 10.44C76.957 10.44 78.2264 10.9347 79.1224 11.924C80.037 12.9133 80.4944 14.3693 80.4944 16.292V25H77.3024V16.572C77.3024 14.2013 76.341 13.016 74.4184 13.016C73.4664 13.016 72.6824 13.3707 72.0664 14.08C71.469 14.7893 71.1704 15.7973 71.1704 17.104V25H67.9784V10.776H71.0024V12.624H71.0584C72.0664 11.168 73.485 10.44 75.3144 10.44ZM88.3593 10.356C90.2633 10.356 91.71 10.8227 92.6993 11.756C93.7073 12.6893 94.2113 14.08 94.2113 15.928V21.248C94.2113 22.7787 94.3326 24.0293 94.5753 25H91.6913C91.5606 24.4213 91.4953 23.7587 91.4953 23.012H91.4393C90.394 24.5427 88.798 25.308 86.6513 25.308C85.1953 25.308 84.0286 24.916 83.1513 24.132C82.274 23.3293 81.8353 22.312 81.8353 21.08C81.8353 19.8667 82.246 18.896 83.0673 18.168C83.9073 17.44 85.3166 16.9173 87.2953 16.6C88.49 16.3947 89.7686 16.2547 91.1313 16.18V15.62C91.1313 13.66 90.2073 12.68 88.3593 12.68C87.5006 12.68 86.8286 12.904 86.3433 13.352C85.858 13.8 85.5966 14.4067 85.5593 15.172H82.4233C82.498 13.7533 83.0393 12.596 84.0473 11.7C85.074 10.804 86.5113 10.356 88.3593 10.356ZM91.1313 18.952V18.252C89.918 18.3267 88.826 18.448 87.8553 18.616C86.8286 18.784 86.1006 19.036 85.6713 19.372C85.2606 19.708 85.0553 20.2027 85.0553 20.856C85.0553 21.4907 85.27 22.004 85.6993 22.396C86.1473 22.7693 86.7726 22.956 87.5753 22.956C88.658 22.956 89.5166 22.6387 90.1513 22.004C90.5246 21.612 90.7766 21.2013 90.9073 20.772C91.0566 20.324 91.1313 19.7173 91.1313 18.952ZM103.817 10.58C104.19 10.58 104.582 10.6267 104.993 10.72V13.548C104.638 13.4733 104.265 13.436 103.873 13.436C102.604 13.436 101.624 13.8373 100.933 14.64C100.261 15.424 99.9251 16.5533 99.9251 18.028V25H96.7331V10.776H99.7011V12.876H99.7571C100.709 11.3453 102.062 10.58 103.817 10.58ZM115.841 10.356C117.67 10.356 119.08 10.776 120.069 11.616C121.077 12.4373 121.59 13.632 121.609 15.2H118.529C118.529 13.52 117.624 12.68 115.813 12.68C115.066 12.68 114.488 12.8293 114.077 13.128C113.666 13.4267 113.461 13.8373 113.461 14.36C113.461 14.92 113.676 15.3213 114.105 15.564C114.534 15.8067 115.393 16.0867 116.681 16.404C117.204 16.5347 117.53 16.6187 117.661 16.656C117.81 16.6933 118.118 16.7867 118.585 16.936C119.07 17.0667 119.388 17.188 119.537 17.3C119.705 17.3933 119.966 17.5333 120.321 17.72C120.676 17.9067 120.918 18.1027 121.049 18.308C121.198 18.4947 121.366 18.728 121.553 19.008C121.758 19.288 121.889 19.6053 121.945 19.96C122.02 20.296 122.057 20.6693 122.057 21.08C122.057 22.3867 121.516 23.4413 120.433 24.244C119.35 25.028 117.904 25.42 116.093 25.42C114.152 25.42 112.64 24.9907 111.557 24.132C110.493 23.2547 109.952 21.9853 109.933 20.324H113.181C113.181 21.2013 113.433 21.8733 113.937 22.34C114.46 22.8067 115.197 23.04 116.149 23.04C116.952 23.04 117.577 22.8813 118.025 22.564C118.492 22.2467 118.725 21.8173 118.725 21.276C118.725 20.604 118.482 20.1373 117.997 19.876C117.512 19.596 116.56 19.2787 115.141 18.924C114.618 18.7933 114.264 18.7093 114.077 18.672C113.909 18.616 113.601 18.5227 113.153 18.392C112.705 18.2427 112.388 18.112 112.201 18C112.014 17.8693 111.762 17.692 111.445 17.468C111.146 17.244 110.932 17.0107 110.801 16.768C110.67 16.5067 110.549 16.1987 110.437 15.844C110.325 15.4707 110.269 15.06 110.269 14.612C110.269 13.3427 110.782 12.316 111.809 11.532C112.836 10.748 114.18 10.356 115.841 10.356ZM129.499 22.564C129.91 22.564 130.236 22.5173 130.479 22.424V24.916C129.9 25.084 129.303 25.168 128.687 25.168C127.175 25.168 126.074 24.832 125.383 24.16C124.711 23.4693 124.375 22.3493 124.375 20.8V13.212H121.995V10.776H124.375V7.22H127.567V10.776H130.339V13.212H127.567V20.324C127.567 21.1267 127.716 21.7053 128.015 22.06C128.314 22.396 128.808 22.564 129.499 22.564ZM138.959 10.58C139.333 10.58 139.725 10.6267 140.135 10.72V13.548C139.781 13.4733 139.407 13.436 139.015 13.436C137.746 13.436 136.766 13.8373 136.075 14.64C135.403 15.424 135.067 16.5533 135.067 18.028V25H131.875V10.776H134.843V12.876H134.899C135.851 11.3453 137.205 10.58 138.959 10.58ZM145.803 10.356C147.707 10.356 149.154 10.8227 150.143 11.756C151.151 12.6893 151.655 14.08 151.655 15.928V21.248C151.655 22.7787 151.776 24.0293 152.019 25H149.135C149.004 24.4213 148.939 23.7587 148.939 23.012H148.883C147.838 24.5427 146.242 25.308 144.095 25.308C142.639 25.308 141.472 24.916 140.595 24.132C139.718 23.3293 139.279 22.312 139.279 21.08C139.279 19.8667 139.69 18.896 140.511 18.168C141.351 17.44 142.76 16.9173 144.739 16.6C145.934 16.3947 147.212 16.2547 148.575 16.18V15.62C148.575 13.66 147.651 12.68 145.803 12.68C144.944 12.68 144.272 12.904 143.787 13.352C143.302 13.8 143.04 14.4067 143.003 15.172H139.867C139.942 13.7533 140.483 12.596 141.491 11.7C142.518 10.804 143.955 10.356 145.803 10.356ZM148.575 18.952V18.252C147.362 18.3267 146.27 18.448 145.299 18.616C144.272 18.784 143.544 19.036 143.115 19.372C142.704 19.708 142.499 20.2027 142.499 20.856C142.499 21.4907 142.714 22.004 143.143 22.396C143.591 22.7693 144.216 22.956 145.019 22.956C146.102 22.956 146.96 22.6387 147.595 22.004C147.968 21.612 148.22 21.2013 148.351 20.772C148.5 20.324 148.575 19.7173 148.575 18.952ZM159.615 22.564C160.026 22.564 160.353 22.5173 160.595 22.424V24.916C160.017 25.084 159.419 25.168 158.803 25.168C157.291 25.168 156.19 24.832 155.499 24.16C154.827 23.4693 154.491 22.3493 154.491 20.8V13.212H152.111V10.776H154.491V7.22H157.683V10.776H160.455V13.212H157.683V20.324C157.683 21.1267 157.833 21.7053 158.131 22.06C158.43 22.396 158.925 22.564 159.615 22.564ZM167.462 23.068C168.358 23.068 169.086 22.8533 169.646 22.424C170.225 21.9947 170.589 21.4253 170.738 20.716H174.014C173.734 22.06 173.015 23.18 171.858 24.076C170.701 24.972 169.235 25.42 167.462 25.42C165.315 25.42 163.626 24.72 162.394 23.32C161.181 21.92 160.574 20.0533 160.574 17.72C160.574 15.5733 161.181 13.8093 162.394 12.428C163.626 11.0467 165.297 10.356 167.406 10.356C169.011 10.356 170.374 10.7947 171.494 11.672C172.633 12.5307 173.398 13.7067 173.79 15.2C174.051 16.04 174.182 17.1507 174.182 18.532H163.738C163.794 20.0627 164.158 21.2013 164.83 21.948C165.521 22.6947 166.398 23.068 167.462 23.068ZM169.842 13.66C169.207 13.0253 168.395 12.708 167.406 12.708C166.417 12.708 165.595 13.0253 164.942 13.66C164.307 14.2947 163.925 15.2187 163.794 16.432H170.99C170.878 15.2187 170.495 14.2947 169.842 13.66ZM181.134 10.384C182.852 10.384 184.233 11.1773 185.278 12.764H185.334V10.776H188.358V24.104C188.358 26.1947 187.789 27.7627 186.65 28.808C185.53 29.872 183.944 30.404 181.89 30.404C180.005 30.404 178.53 30.0027 177.466 29.2C176.421 28.416 175.861 27.3147 175.786 25.896H178.978C179.016 26.5867 179.296 27.1187 179.818 27.492C180.341 27.8653 181.05 28.052 181.946 28.052C183.048 28.052 183.869 27.7347 184.41 27.1C184.97 26.4653 185.25 25.4293 185.25 23.992V22.592H185.194C184.168 24.0853 182.796 24.832 181.078 24.832C179.268 24.832 177.83 24.1787 176.766 22.872C175.702 21.5653 175.17 19.8107 175.17 17.608C175.17 15.4053 175.712 13.6507 176.794 12.344C177.877 11.0373 179.324 10.384 181.134 10.384ZM181.862 13.044C180.836 13.044 180.014 13.4547 179.398 14.276C178.801 15.0973 178.502 16.208 178.502 17.608C178.502 19.008 178.801 20.128 179.398 20.968C180.014 21.7893 180.836 22.2 181.862 22.2C182.945 22.2 183.794 21.7893 184.41 20.968C185.045 20.128 185.362 19.008 185.362 17.608C185.362 16.208 185.045 15.0973 184.41 14.276C183.794 13.4547 182.945 13.044 181.862 13.044ZM199.121 10.776H202.425L196.937 25.616C196.265 27.408 195.472 28.64 194.557 29.312C193.661 29.984 192.382 30.32 190.721 30.32C190.142 30.32 189.61 30.2547 189.125 30.124V27.52C189.554 27.6507 190.002 27.716 190.469 27.716C191.328 27.716 191.981 27.5293 192.429 27.156C192.896 26.7827 193.297 26.1013 193.633 25.112L188.425 10.776H191.841L195.397 21.36H195.453L199.121 10.776Z" fill="#1800ad"/>
          <path d="M11.6666 11.9981C11.6666 11.8143 11.8156 11.6654 11.9994 11.6654H23.3334V22.9994C23.3334 23.1832 23.1844 23.3321 23.0006 23.3321H11.6666V11.9981Z" fill="#1800ad"/>
          <path d="M-4.57764e-05 23.6659C-4.57764e-05 23.4821 0.148945 23.3332 0.332734 23.3332H11.6667V34.6672C11.6667 34.851 11.5178 34.9999 11.334 34.9999H0.332734C0.148944 34.9999 -4.57764e-05 34.851 -4.57764e-05 34.6672V23.6659Z" fill="#1800ad"/>
          <path d="M23.333 0.332779C23.333 0.14899 23.482 0 23.6657 0H34.667C34.8508 0 34.9998 0.148991 34.9998 0.33278V11.334C34.9998 11.5178 34.8508 11.6668 34.667 11.6668H23.333V0.332779Z" fill="#1800ad"/>
          <path d="M12.3328 23.333C11.816 23.3327 11.6654 23.4736 11.6662 23.9997L10.9995 23.333C11.5124 23.3333 11.6657 23.1944 11.6662 22.6663L12.3328 23.333Z" fill="#1800ad"/>
          <path d="M23.9996 11.6663C23.4827 11.6661 23.3322 11.807 23.3329 12.333L22.6662 11.6663C23.1791 11.6666 23.3325 11.5277 23.3329 10.9997L23.9996 11.6663Z" fill="#1800ad"/>
        </svg>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-start px-5 sm:px-8 py-4 sm:py-8">
        <AnimatePresence mode="wait">

          {/* FORM */}
          {stage === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center w-full max-w-lg pb-12"
            >
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-2 sm:mb-3"
                style={{ color: BRAND, fontWeight: 700, letterSpacing: "-0.03em" }}
              >
                win more, lock in more deals, create your mediakit
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="text-sm sm:text-base leading-relaxed mb-6 sm:mb-8"
                style={{ color: BRAND, opacity: 0.6, fontWeight: 300 }}
              >
                fill in your details and generate a professional crypto influencer media kit
              </motion.p>

              <form onSubmit={handleGenerate} className="w-full text-left flex flex-col gap-4">
                {/* X Account — first so they can fetch profile */}
                <label className="text-xs font-bold tracking-widest uppercase" style={{ color: BRAND, opacity: 0.5 }}>YOUR X PROFILE</label>
                <div className="flex items-center gap-3 rounded-full px-5 py-3" style={{ background: "#cde2f5" }}>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill={BRAND} style={{ opacity: 0.5 }}>
                    <path d={PLATFORM_ICONS.twitter} />
                  </svg>
                  <input
                    type="text"
                    value={data.socials[0]?.handle || ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const handle = parseXHandle(raw);
                      updateSocial(0, "handle", handle || raw);
                      // Debounced PFP fetch from unavatar (free)
                      if (pfpTimerRef.current) clearTimeout(pfpTimerRef.current);
                      if (handle && handle.length >= 2 && /^\w+$/.test(handle)) {
                        pfpTimerRef.current = setTimeout(() => {
                          updateField("profileImageUrl", `https://unavatar.io/x/${handle}`);
                          updateField("displayName", handle);
                        }, 600);
                      }
                    }}
                    placeholder="x.com/your_handle or @your_handle"
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                    style={{ color: BRAND, fontWeight: 300, fontFamily: "'Neue Haas Unica', sans-serif" }}
                  />
                </div>

                {/* PFP preview */}
                {data.profileImageUrl && (
                  <div className="flex items-center gap-3">
                    <img
                      src={data.profileImageUrl}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover"
                      style={{ border: `2px solid ${BRAND}25` }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                    <span className="text-xs" style={{ color: BRAND, opacity: 0.5 }}>
                      @{data.socials[0]?.handle}
                    </span>
                  </div>
                )}

                {/* Follower Count */}
                <FormInput
                  label="Follower Count"
                  value={data.socials[0]?.followers || ""}
                  onChange={(v) => updateSocial(0, "followers", v)}
                  placeholder="269,655"
                />

                {/* About You */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold tracking-widest uppercase" style={{ color: BRAND, opacity: 0.5 }}>BIO</label>
                  <textarea
                    value={data.bio}
                    onChange={(e) => updateField("bio", e.target.value)}
                    placeholder="Tell crypto projects about yourself in 2-3 sentences..."
                    rows={3}
                    className="rounded-3xl px-5 py-3 text-sm focus:outline-none focus:ring-0 resize-none"
                    style={inputStyle}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold tracking-widest uppercase" style={{ color: BRAND, opacity: 0.5 }}>NICHES (select multiple)</label>
                  <div className="flex flex-wrap gap-2">
                    {NICHE_OPTIONS.map((n) => {
                      const selected = data.niche.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            if (selected) {
                              updateField("niche", data.niche.filter((x) => x !== n));
                            } else {
                              updateField("niche", [...data.niche, n]);
                            }
                          }}
                          className="px-3.5 py-2 rounded-full text-xs font-bold tracking-wide transition-all"
                          style={{
                            background: selected ? BRAND : "#cde2f5",
                            color: selected ? "#fff" : BRAND,
                            fontFamily: "'Neue Haas Unica', sans-serif",
                            opacity: selected ? 1 : 0.7,
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div className="my-1" style={{ height: "1px", background: `${BRAND}15` }} />

                {/* CSV upload — auto-fills the stats below */}
                <CsvUpload onParsed={handleAnalyticsParsed} />

                {/* Stats & Contact */}
                <FormInput label="Engagement Rate (%)" value={data.engagementRate} onChange={(v) => updateField("engagementRate", v)} placeholder="1.41" />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput label="Impressions (90 days)" value={data.impressions} onChange={(v) => updateField("impressions", v)} placeholder="141400000" />
                  <FormInput label="Engagements (90 days)" value={data.engagements} onChange={(v) => updateField("engagements", v)} placeholder="2260000" />
                </div>
                <FormInput label="Contact Email" value={data.email} onChange={(v) => updateField("email", v)} placeholder="contact@cryptosensei.io" type="email" />

                {/* Divider */}
                <div className="my-1" style={{ height: "1px", background: `${BRAND}15` }} />

                {/* Proposed Deal */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold tracking-widest uppercase" style={{ color: BRAND, opacity: 0.5 }}>PROPOSED DEAL <span style={{ opacity: 0.5, fontWeight: 300, textTransform: "lowercase", letterSpacing: "0.02em" }}>(optional)</span></label>
                  <textarea
                    value={data.proposedDeal}
                    onChange={(e) => updateField("proposedDeal", e.target.value)}
                    placeholder="4 X (Twitter) Posts delivered over 4 weeks"
                    rows={2}
                    className="rounded-3xl px-5 py-3 text-sm focus:outline-none focus:ring-0 resize-none"
                    style={inputStyle}
                  />
                </div>
                <FormInput label="Deal Price ($) (optional)" value={data.dealPrice} onChange={(v) => updateField("dealPrice", v)} placeholder="8,000" />

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs mt-1 text-center" style={{ color: "#e03" }}>
                    {error}
                  </motion.p>
                )}

                {/* Generate button */}
                <div className="mt-4">
                  <button
                    type="submit"
                    className="w-full px-6 py-3.5 rounded-full text-sm font-bold tracking-wide active:scale-[0.98]"
                    style={{ background: BRAND, color: "#ffffff", fontFamily: "'Neue Haas Unica', sans-serif", fontWeight: 700, transition: "background 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#cde2f5"; e.currentTarget.style.color = BRAND; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = BRAND; e.currentTarget.style.color = "#ffffff"; }}
                  >
                    generate media kit
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* LOADING */}
          {stage === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center text-center py-24"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1, 1.1, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                className="text-8xl sm:text-9xl mb-6"
              >
                👨‍🍳
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-lg sm:text-xl font-bold tracking-tight"
                style={{ color: BRAND }}
              >
                cooking your media kit...
              </motion.p>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "200px" }}
                transition={{ duration: 2.2, ease: "easeInOut" }}
                className="h-1 rounded-full mt-4"
                style={{ background: BRAND }}
              />
            </motion.div>
          )}

          {/* RESULT */}
          {stage === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full max-w-4xl px-1"
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center mb-4 sm:mb-6"
              >
                <p className="text-xs font-mono tracking-widest mb-2" style={{ color: BRAND, opacity: 0.4 }}>
                  your media kit is ready
                </p>
                <h2 className="text-xl sm:text-2xl" style={{ color: BRAND, fontWeight: 700 }}>
                  {data.displayName}
                </h2>
              </motion.div>

              {/* Color swatches */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-2 mb-5"
              >
                {COLOR_SWATCHES.filter(s => s.hex).map((swatch) => (
                  <button
                    key={swatch.hex}
                    onClick={() => setBgColor(bgColor === swatch.hex ? "" : swatch.hex)}
                    title={swatch.label}
                    className="rounded-full transition-all"
                    style={{
                      width: bgColor === swatch.hex ? 28 : 22,
                      height: bgColor === swatch.hex ? 28 : 22,
                      background: swatch.hex,
                      border: bgColor === swatch.hex ? "3px solid rgba(24,0,173,0.5)" : "2px solid rgba(24,0,173,0.15)",
                      boxShadow: bgColor === swatch.hex ? "0 0 0 2px #fff" : "none",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </motion.div>

              <MediaKitCardAnimated data={data} cardRef={cardRef} theme={cardTheme} bgColor={bgColor || undefined} />

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-3 mt-6 sm:mt-8 w-full"
              >
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 sm:py-3.5 rounded-full text-sm font-bold tracking-wide active:scale-[0.98]"
                  style={{ background: BRAND, color: "#ffffff", fontFamily: "'Neue Haas Unica', sans-serif", fontWeight: 700, transition: "background 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#12008a"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = BRAND; }}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  download PNG
                </button>
                <button
                  onClick={handleCopyImage}
                  disabled={copyState === "copying"}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 sm:py-3.5 rounded-full text-sm font-bold tracking-wide active:scale-[0.98]"
                  style={{
                    background: copyState === "done" ? "#1a9e5c" : "#cde2f5",
                    color: copyState === "done" ? "#ffffff" : BRAND,
                    fontFamily: "'Neue Haas Unica', sans-serif",
                    fontWeight: 700,
                    transition: "background 0.15s, color 0.15s",
                    opacity: copyState === "copying" ? 0.7 : 1,
                    cursor: copyState === "copying" ? "wait" : "pointer",
                  }}
                >
                  {copyState === "done" ? (
                    <>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      copied!
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      copy image
                    </>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 sm:py-3.5 rounded-full text-sm font-bold tracking-wide active:scale-[0.98]"
                  style={{ background: "#cde2f5", color: BRAND, fontFamily: "'Neue Haas Unica', sans-serif", fontWeight: 700, transition: "background 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#b8d4ee"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#cde2f5"; }}
                >
                  edit details
                </button>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
