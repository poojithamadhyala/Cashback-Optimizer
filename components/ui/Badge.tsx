import type { ReactNode } from "react";
import styles from "./Badge.module.css";

type Tone = "neutral" | "earned" | "missed" | "info" | "warn";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={[styles.badge, styles[tone]].join(" ")}>{children}</span>;
}

/** Status badge for receipts: confirmed = earned tone, needs_review = warn. */
export function StatusBadge({ status }: { status: "needs_review" | "confirmed" }) {
  return status === "confirmed" ? (
    <Badge tone="earned">Confirmed</Badge>
  ) : (
    <Badge tone="warn">Needs review</Badge>
  );
}

/** Confidence badge from a 0..1 score. */
export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  const pct = confidence == null ? null : Math.round(confidence * 100);
  const tone: Tone =
    confidence == null || confidence < 0.5 ? "missed" : confidence < 0.8 ? "warn" : "earned";
  return <Badge tone={tone}>{pct == null ? "No OCR" : `${pct}% confidence`}</Badge>;
}
