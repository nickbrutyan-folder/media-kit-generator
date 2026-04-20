/**
 * Typed client for /api/x/profile.
 *
 * The endpoint proxies Sorsa's /info + /user-tweets on our VPS, caches for 24h,
 * and returns a slim shape optimized for filling the media kit form.
 */

export interface XProfile {
  username: string | null;
  display_name: string | null;
  description: string | null;
  profile_image_url: string | null;
  banner_url: string | null;
  followers_count: number;
  following_count: number;
  tweets_count: number;
  verified: boolean;
  protected: boolean;
  location: string | null;
  created_at: string | null;
}

export interface XProfileResponse {
  profile: XProfile;
  cached: boolean;
  age_ms: number;
}

export interface XProfileError {
  status: number;
  code: string;       // machine-readable, e.g. "user-not-found"
  message: string;    // human-readable
}

/** Friendly messages keyed on the API error codes. */
const FRIENDLY: Record<string, string> = {
  "user-not-found":        "We couldn't find that handle on X.",
  "invalid-username":      "That doesn't look like a valid X handle.",
  "sorsa-not-configured":  "X lookup isn't configured yet — try again later.",
  "sorsa-auth-failed":     "X lookup key is bad — ping Nick.",
  "sorsa-unreachable":     "X lookup is down right now — you can fill these in manually.",
  "sorsa-info-error":      "X lookup failed — try again or fill in manually.",
  "rate-limited":          "Too many lookups, slow down a sec.",
  "internal":              "Something broke on our end — you can still fill the form manually.",
};

export async function fetchXProfile(username: string): Promise<XProfileResponse> {
  const clean = username.trim().replace(/^@/, "");
  const res = await fetch(`/api/x/profile?username=${encodeURIComponent(clean)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    let code = "internal";
    try {
      const body = await res.json();
      if (typeof body?.error === "string") code = body.error;
    } catch { /* ignore */ }
    if (res.status === 429) code = "rate-limited";
    const err: XProfileError = {
      status: res.status,
      code,
      message: FRIENDLY[code] ?? `Lookup failed (${res.status})`,
    };
    throw err;
  }

  return res.json();
}
