/**
 * Pure UI formatting helpers. No React, no DOM — just deterministic
 * string/number formatting used across pages. Unit-tested offline.
 */

/** Format a dollar amount: 3 -> "$3.00", 3.5 -> "$3.50", -0 -> "$0.00". */
export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const normalized = safe === 0 ? 0 : safe; // avoid "-$0.00"
  const sign = normalized < 0 ? "-" : "";
  return `${sign}$${Math.abs(normalized).toFixed(2)}`;
}

/** "missed" phrasing for the dashboard/receipt result. */
export function formatMissed(missed: number): string {
  if (!Number.isFinite(missed) || missed <= 0) return "Optimal card used";
  return `Missed ${formatCurrency(missed)}`;
}

/** Percentage display: 3 -> "3%", 2.5 -> "2.5%". */
export function formatPct(pct: number): string {
  const safe = Number.isFinite(pct) ? pct : 0;
  // Trim trailing zeros: 3.00 -> "3", 2.50 -> "2.5"
  return `${parseFloat(safe.toFixed(2))}%`;
}

export type ConfidenceLevel = "high" | "medium" | "low";

/** Bucket an OCR confidence (0..1) for badge display. */
export function confidenceLevel(confidence: number | null): ConfidenceLevel {
  if (confidence === null || !Number.isFinite(confidence)) return "low";
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

/** Human label for a receipt status. */
export function statusLabel(status: "needs_review" | "confirmed"): string {
  return status === "confirmed" ? "Confirmed" : "Needs review";
}

/** Turn a canonical category key into a display label: "us_supermarkets" -> "US supermarkets". */
export function categoryLabel(category: string | null): string {
  if (!category) return "Uncategorized";
  const special: Record<string, string> = {
    us_supermarkets: "US supermarkets",
    us_gas_stations: "US gas stations",
    us_online_retail: "US online retail",
    gas_ev_charging: "Gas / EV charging",
    online_groceries: "Online groceries",
    rideshare_lyft: "Lyft rides",
    chase_travel: "Chase Travel",
    citi_travel: "Citi Travel",
    vacation_rentals: "Vacation rentals",
    peloton: "Peloton",
    dining: "Dining",
  };
  if (special[category]) return special[category];
  return category
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
