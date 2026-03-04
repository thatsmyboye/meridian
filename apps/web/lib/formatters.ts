/** Formats a number with K/M suffixes for compact display. */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Formats an ISO date string as a human-readable date (e.g. "Jan 15, 2025"). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Platform brand colours used across dashboard, charts, and detail pages. */
export const PLATFORM_COLORS: Record<string, string> = {
  youtube: "#dc2626",
  instagram: "#7c3aed",
  beehiiv: "#f97316",
  tiktok: "#111827",
};

/** Platform badge styles (background + foreground) for pill labels. */
export const PLATFORM_BADGE: Record<string, { bg: string; color: string }> = {
  youtube: { bg: "#fee2e2", color: "#dc2626" },
  instagram: { bg: "#ede9fe", color: "#7c3aed" },
  beehiiv: { bg: "#ffedd5", color: "#f97316" },
  tiktok: { bg: "#f3f4f6", color: "#111827" },
};
