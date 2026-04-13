export interface SocialPlatform {
  platform: "twitter" | "youtube";
  handle: string;
  followers: string;
}

export interface MediaKitData {
  displayName: string;
  bio: string;
  niche: string[];
  email: string;
  profileImageUrl: string;
  socials: SocialPlatform[];
  engagementRate: string;
  avgLikes: string;
  avgComments: string;
  // New fields for Ted-style template
  impressions: string;
  engagements: string;
  proposedDeal: string;
  dealPrice: string;
}

export const NICHE_OPTIONS = [
  "DeFi & DEXs",
  "NFTs & Digital Art",
  "Bitcoin & Maxis",
  "Trading & Technical Analysis",
  "Altcoins & Gems",
  "Layer 1s & Layer 2s",
  "GameFi & P2E",
  "DAOs & Governance",
  "Memecoins",
  "Crypto News & Alpha",
  "Staking & Yield",
  "RWA & Tokenization",
  "AI x Crypto",
  "Regulation & Policy",
  "Prediction Markets",
  "Stablecoins",
  "Investments",
  "Other",
];

// Sub-niches to show as tag chips on the card
export const NICHE_TAGS: Record<string, string[]> = {
  "DeFi & DEXs": ["DeFi", "DEXs", "Yield", "Liquidity"],
  "NFTs & Digital Art": ["NFTs", "Digital Art", "Collections", "Minting"],
  "Bitcoin & Maxis": ["Bitcoin", "BTC", "Lightning", "Store of Value"],
  "Trading & Technical Analysis": ["Trading", "TA", "Market Sentiment", "Charts"],
  "Altcoins & Gems": ["Altcoins", "Low Caps", "Gems", "Research"],
  "Layer 1s & Layer 2s": ["Layer 1", "Layer 2", "Scaling", "Infrastructure"],
  "GameFi & P2E": ["GameFi", "P2E", "Gaming", "Metaverse"],
  "DAOs & Governance": ["DAOs", "Governance", "Voting", "Treasury"],
  "Memecoins": ["Memecoins", "Degen", "Community", "Viral"],
  "Crypto News & Alpha": ["News", "Alpha", "Research", "Analysis"],
  "Staking & Yield": ["Staking", "Yield", "Validators", "Rewards"],
  "RWA & Tokenization": ["RWA", "Tokenization", "Real Assets", "TradFi"],
  "AI x Crypto": ["AI", "Crypto", "Machine Learning", "Agents"],
  "Regulation & Policy": ["Regulation", "Policy", "Compliance", "Legal"],
  "Prediction Markets": ["Prediction Markets", "Polymarket", "Betting", "Forecasting"],
  "Stablecoins": ["Stablecoins", "USDT", "USDC", "Pegged Assets"],
  "Investments": ["Investing", "Portfolio", "Long-term", "Macro"],
  "Other": ["Crypto", "Web3", "Blockchain"],
};

export const PLATFORM_LABELS: Record<SocialPlatform["platform"], string> = {
  twitter: "X / Twitter",
  youtube: "YouTube",
};

export const PLATFORM_ICONS: Record<SocialPlatform["platform"], string> = {
  twitter: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  youtube: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
};

export function formatFollowers(num: string): string {
  const n = parseInt(num.replace(/[^0-9]/g, ""), 10);
  if (isNaN(n)) return num;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export function formatNumber(num: string): string {
  const n = parseInt(num.replace(/[^0-9]/g, ""), 10);
  if (isNaN(n)) return num;
  return n.toLocaleString();
}

export function getTotalFollowers(socials: SocialPlatform[]): string {
  const total = socials.reduce((sum, s) => {
    const n = parseInt(s.followers.replace(/[^0-9]/g, ""), 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  return formatFollowers(total.toString());
}
