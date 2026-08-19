/**
 * Merchant normalizer/categorizer — Section 4.2.
 *
 * merchant_raw -> { merchant_normalized, category }.
 * Rules-based first, with an EXPLICIT "unresolved" output rather than a forced
 * guess (Section 2: unknown merchants fall back to Uncategorized requiring user
 * input, never a silent guess feeding money math).
 *
 * The categories produced here are the same canonical strings the rewards
 * engine rules key on (see lib/fixtures/cards.ts).
 */

export type Category =
  | "us_supermarkets"
  | "online_groceries"
  | "us_gas_stations"
  | "gas_ev_charging"
  | "dining"
  | "us_online_retail"
  | "rideshare_lyft"
  | "chase_travel"
  | "citi_travel"
  | "vacation_rentals"
  | "peloton";

export interface CategorizationResult {
  merchantNormalized: string;
  /** null => Uncategorized: requires explicit user input (Section 2). */
  category: Category | null;
  resolved: boolean;
}

interface Rule {
  /** Substring (already normalized/uppercased) to match in the merchant name. */
  match: string;
  category: Category;
}

// Minimal starter rule set. Extend with researched merchant data. Order matters
// only for readability; first match wins.
const RULES: Rule[] = [
  { match: "TRADER JOE", category: "us_supermarkets" },
  { match: "WHOLE FOODS", category: "us_supermarkets" },
  { match: "SAFEWAY", category: "us_supermarkets" },
  { match: "KROGER", category: "us_supermarkets" },
  { match: "INSTACART", category: "online_groceries" },
  { match: "SHELL", category: "us_gas_stations" },
  { match: "CHEVRON", category: "us_gas_stations" },
  { match: "EXXON", category: "us_gas_stations" },
  { match: "TESLA SUPERCHARGER", category: "gas_ev_charging" },
  { match: "CHIPOTLE", category: "dining" },
  { match: "STARBUCKS", category: "dining" },
  { match: "AMAZON", category: "us_online_retail" },
  { match: "LYFT", category: "rideshare_lyft" },
  { match: "AIRBNB", category: "vacation_rentals" },
  { match: "PELOTON", category: "peloton" },
];

/** Normalize a raw merchant string: uppercase, collapse whitespace, strip store #. */
export function normalizeMerchant(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/#\s*\d+/g, "") // strip "#123" store numbers
    .replace(/\s+/g, " ")
    .trim();
}

export function categorize(merchantRaw: string): CategorizationResult {
  const normalized = normalizeMerchant(merchantRaw);
  const hit = RULES.find((r) => normalized.includes(r.match));

  if (!hit) {
    // Explicit unresolved: do NOT guess. Section 2 acceptance criterion.
    return { merchantNormalized: normalized, category: null, resolved: false };
  }
  return { merchantNormalized: normalized, category: hit.category, resolved: true };
}
