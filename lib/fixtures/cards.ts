/**
 * Researched card fixtures — real reward data, current as of 2026-08-19.
 *
 * Spec reference: Section 9 (Seed Card Catalog). These are the same rows that
 * seed `card_catalog` + `card_reward_rules`. Each rule carries source_url and
 * lastVerifiedAt per the versioning requirement (Section 2/3).
 *
 * Design implication (Section 9): CSP is points-based (unit
 * "points_per_dollar", pointValueCents 2 => ~2c/pt => 5x ~= 10% effective),
 * while Amex BCE and Citi Double Cash are true cashback (unit "cashback_pct").
 *
 * Section 10 decision: Citi Double Cash modeled as flat 2% in v1
 * (the "pay to earn the 2nd 1%" mechanic is a known simplification, deferred).
 *
 * NOTE ON CATEGORIES: the `category` strings here are the canonical spending
 * categories the merchant categorizer (Section 4.2) must map merchants to.
 * "*" is the card's baseline ("everything else") rate.
 */

import type { RewardRule, CardForEval } from "../rewards-engine.ts";

export interface CatalogCard {
  cardId: string;
  issuer: string;
  productName: string;
  network: string;
  annualFeeUsd: number;
  sourceUrl: string;
  lastVerifiedAt: string; // ISO date
  rules: RewardRule[];
}

const VERIFIED = "2026-08-19";

// Chase Sapphire Preferred ($95 AF). Points-based: ~2c/pt effective.
export const chaseSapphirePreferred: CatalogCard = {
  cardId: "chase-sapphire-preferred",
  issuer: "Chase",
  productName: "Sapphire Preferred",
  network: "Visa",
  annualFeeUsd: 95,
  sourceUrl: "https://www.chase.com/ (cross-ref thepointsguy.com)",
  lastVerifiedAt: VERIFIED,
  rules: [
    { id: "csp-chase-travel", category: "chase_travel", rate: 5, unit: "points_per_dollar", pointValueCents: 2 },
    { id: "csp-lyft", category: "rideshare_lyft", rate: 5, unit: "points_per_dollar", pointValueCents: 2, effectiveTo: "2027-09-30" },
    { id: "csp-peloton", category: "peloton", rate: 5, unit: "points_per_dollar", pointValueCents: 2, effectiveTo: "2027-12-31" },
    { id: "csp-dining", category: "dining", rate: 3, unit: "points_per_dollar", pointValueCents: 2 },
    { id: "csp-gas-ev", category: "gas_ev_charging", rate: 3, unit: "points_per_dollar", pointValueCents: 2 },
    { id: "csp-online-groceries", category: "online_groceries", rate: 3, unit: "points_per_dollar", pointValueCents: 2 },
    { id: "csp-travel-rentals", category: "vacation_rentals", rate: 3, unit: "points_per_dollar", pointValueCents: 2 },
    { id: "csp-baseline", category: "*", rate: 1, unit: "points_per_dollar", pointValueCents: 2 },
  ],
};

// Amex Blue Cash Everyday ($0 AF). Cashback with $6,000/yr caps -> 1% after.
export const amexBlueCashEveryday: CatalogCard = {
  cardId: "amex-blue-cash-everyday",
  issuer: "American Express",
  productName: "Blue Cash Everyday",
  network: "Amex",
  annualFeeUsd: 0,
  sourceUrl: "https://www.moneyatlas.com/ (cross-ref usnews.com)",
  lastVerifiedAt: VERIFIED,
  rules: [
    { id: "bce-supermarkets", category: "us_supermarkets", rate: 3, unit: "cashback_pct", capAmount: 6000 },
    { id: "bce-gas", category: "us_gas_stations", rate: 3, unit: "cashback_pct", capAmount: 6000 },
    { id: "bce-online-retail", category: "us_online_retail", rate: 3, unit: "cashback_pct", capAmount: 6000 },
    { id: "bce-baseline", category: "*", rate: 1, unit: "cashback_pct" },
  ],
};

// Citi Double Cash ($0 AF). Flat 2% baseline (v1 simplification), 5% Citi Travel.
export const citiDoubleCash: CatalogCard = {
  cardId: "citi-double-cash",
  issuer: "Citi",
  productName: "Double Cash",
  network: "Mastercard",
  annualFeeUsd: 0,
  sourceUrl: "https://www.creditkarma.com/ (cross-ref wealthvieu.com)",
  lastVerifiedAt: VERIFIED,
  rules: [
    { id: "cdc-citi-travel", category: "citi_travel", rate: 5, unit: "cashback_pct" },
    // v1 simplification (Section 10): flat 2% baseline. In reality this is
    // 1% at purchase + 1% at on-time payment; the payment-dependency is a
    // data-integrity note tracked for v2, NOT a rate exception here.
    { id: "cdc-baseline", category: "*", rate: 2, unit: "cashback_pct" },
  ],
};

export const catalog: CatalogCard[] = [
  chaseSapphirePreferred,
  amexBlueCashEveryday,
  citiDoubleCash,
];

/** Convert a catalog card into the shape the rewards engine consumes. */
export function toCardForEval(c: CatalogCard): CardForEval {
  return {
    cardId: c.cardId,
    label: `${c.issuer} ${c.productName}`,
    rules: c.rules,
  };
}

export const catalogForEval: CardForEval[] = catalog.map(toCardForEval);
