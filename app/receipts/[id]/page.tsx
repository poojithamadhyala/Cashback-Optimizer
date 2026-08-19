"use client";

// Receipt review/confirm — Section 2 (Receipt Upload & OCR + Rewards Calculation).
// A needs_review receipt requires the user to fill/confirm merchant, category,
// date, total, and which card they used before it can be confirmed. On confirm,
// the server runs the rewards engine and returns the calculation (actual vs
// optimal vs missed), which we display.
// Data logic unchanged from pre-restyle — only markup/styles + an empty-cards hint.
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/ui/errors";
import { formatCurrency, formatMissed, categoryLabel } from "@/lib/ui/format";
import { ALL_CATEGORIES } from "@/lib/categorizer/categorizer";
import type { ReceiptDTO, UserCardDTO, RewardCalculationDTO } from "@/lib/api/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { StatusBadge, ConfidenceBadge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Spinner, ErrorBanner } from "@/components/ui/Feedback";
import styles from "./review.module.css";

export default function ReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [receipt, setReceipt] = useState<ReceiptDTO | null>(null);
  const [cards, setCards] = useState<UserCardDTO[]>([]);
  const [calc, setCalc] = useState<RewardCalculationDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Editable fields
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");
  const [userCardId, setUserCardId] = useState("");

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([api.getReceipt(id), api.getMyCards()]);
    if (r.ok) {
      const rec = r.data.receipt;
      setReceipt(rec);
      setCategory(rec.category ?? "");
      setDate(rec.date ?? "");
      setTotal(rec.totalAmount != null ? String(rec.totalAmount) : "");
      setUserCardId(rec.userCardId ?? "");
    } else setError(errorMessage(r.error));
    if (c.ok) setCards(c.data.cards);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api.confirmReceipt(id, {
      category: category || undefined,
      date: date || undefined,
      totalAmount: total ? Number(total) : undefined,
      userCardId: userCardId || undefined,
    });
    setBusy(false);
    if (res.ok) {
      setReceipt(res.data.receipt);
      setCalc(res.data.calculation);
    } else {
      setError(errorMessage(res.error));
    }
  }

  async function onDelete() {
    const res = await api.deleteReceipt(id);
    if (res.ok) router.push("/receipts");
    else setError(errorMessage(res.error));
  }

  if (!receipt) {
    return (
      <main className="page-narrow">
        {error ? <ErrorBanner>{error}</ErrorBanner> : <Spinner label="Loading receipt…" />}
      </main>
    );
  }

  const noCards = cards.length === 0;

  return (
    <main className="page">
      <div className={styles.head}>
        <h1>Receipt</h1>
        <div className={styles.badges}>
          <StatusBadge status={receipt.status} />
          <ConfidenceBadge confidence={receipt.ocrConfidence} />
        </div>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className={styles.layout}>
        {/* Left: the scanned image */}
        <Card className={styles.imageCard}>
          {receipt.imageUrl ? (
            // Served by GET /api/receipts/:id/image (ownership-checked); the stored
            // local://<key> reference isn't a browser-loadable URL directly.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/receipts/${receipt.id}/image`}
              alt="Receipt"
              className={styles.image}
            />
          ) : (
            <div className={styles.noImage}>No image</div>
          )}
          {receipt.merchantRaw && (
            <p className={styles.ocrRead}>OCR read: “{receipt.merchantRaw}”</p>
          )}
        </Card>

        {/* Right: the review/confirm form */}
        <Card>
          <h2>Review &amp; confirm</h2>
          <p className="text-muted" style={{ marginTop: -4 }}>
            Confirm the details below so we can compute your rewards.
          </p>

          {noCards && (
            <div className={styles.hint}>
              You haven&apos;t added any cards yet — we need to know which card you
              used. <Link href="/cards">Add a card →</Link>
            </div>
          )}

          <form onSubmit={onConfirm} className={styles.form}>
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">— select —</option>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className={styles.twoCol}>
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Total ($)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Card used">
              <Select value={userCardId} onChange={(e) => setUserCardId(e.target.value)}>
                <option value="">— select —</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nickname ?? c.cardCatalogId}
                  </option>
                ))}
              </Select>
            </Field>

            <div className={styles.actions}>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : receipt.status === "confirmed" ? "Recalculate" : "Confirm"}
              </Button>
              <Button type="button" variant="danger" onClick={onDelete}>
                Delete
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {calc && (
        <section className={styles.resultSection}>
          <h2>Result</h2>
          <div className={styles.resultCards}>
            <StatCard label="You earned" value={formatCurrency(calc.actualCashback)} tone="earned" />
            <StatCard label="Best available" value={formatCurrency(calc.optimalCashback)} />
            <StatCard
              label={calc.missedAmount > 0 ? "Missed" : "Result"}
              value={calc.missedAmount > 0 ? formatCurrency(calc.missedAmount) : "Optimal!"}
              tone={calc.missedAmount > 0 ? "missed" : "earned"}
              sub={formatMissed(calc.missedAmount)}
            />
          </div>
        </section>
      )}
    </main>
  );
}
