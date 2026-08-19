"use client";

// Receipt review/confirm — Section 2 (Receipt Upload & OCR + Rewards Calculation).
// A needs_review receipt requires the user to fill/confirm merchant, category,
// date, total, and which card they used before it can be confirmed. On confirm,
// the server runs the rewards engine and returns the calculation (actual vs
// optimal vs missed), which we display.
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/ui/errors";
import {
  confidenceLevel,
  statusLabel,
  formatCurrency,
  formatMissed,
  categoryLabel,
} from "@/lib/ui/format";
import { ALL_CATEGORIES } from "@/lib/categorizer/categorizer";
import type { ReceiptDTO, UserCardDTO, RewardCalculationDTO } from "@/lib/api/types";

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
      <main style={styles.wrap}>
        {error ? <p role="alert" style={styles.error}>{error}</p> : <p>Loading…</p>}
      </main>
    );
  }

  return (
    <main style={styles.wrap}>
      <h1>Receipt</h1>
      <p style={styles.meta}>
        Status: <strong>{statusLabel(receipt.status)}</strong> · OCR confidence:{" "}
        {receipt.ocrConfidence != null
          ? `${(receipt.ocrConfidence * 100).toFixed(0)}% (${confidenceLevel(receipt.ocrConfidence)})`
          : "—"}
      </p>
      {receipt.merchantRaw && (
        <p style={styles.meta}>OCR read: “{receipt.merchantRaw}”</p>
      )}

      {receipt.imageUrl && (
        // The image is served by GET /api/receipts/:id/image (ownership-checked),
        // since the stored reference (local://<key>) isn't a browser-loadable URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/receipts/${receipt.id}/image`}
          alt="Receipt"
          style={styles.receiptImage}
        />
      )}

      {error && <p role="alert" style={styles.error}>{error}</p>}

      <form onSubmit={onConfirm} style={styles.form}>
        <label style={styles.label}>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
            <option value="">— select —</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.label}>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
        </label>
        <label style={styles.label}>
          Total ($)
          <input
            type="number"
            step="0.01"
            min="0"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          Card used
          <select value={userCardId} onChange={(e) => setUserCardId(e.target.value)} style={styles.input}>
            <option value="">— select —</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname ?? c.cardCatalogId}
              </option>
            ))}
          </select>
        </label>

        <div style={styles.actions}>
          <button type="submit" disabled={busy} style={styles.btn}>
            {busy ? "Saving…" : receipt.status === "confirmed" ? "Recalculate" : "Confirm"}
          </button>
          <button type="button" onClick={onDelete} style={styles.deleteBtn}>
            Delete
          </button>
        </div>
      </form>

      {calc && (
        <section style={styles.result}>
          <h2>Result</h2>
          <p>You earned: <strong>{formatCurrency(calc.actualCashback)}</strong></p>
          <p>Best available: <strong>{formatCurrency(calc.optimalCashback)}</strong></p>
          <p style={calc.missedAmount > 0 ? styles.missed : styles.ok}>
            {formatMissed(calc.missedAmount)}
          </p>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: "system-ui", maxWidth: 560, margin: "32px auto", padding: 24 },
  form: { display: "flex", flexDirection: "column", gap: 12, marginTop: 16 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 14 },
  input: { padding: 8, fontSize: 16, border: "1px solid #ccc", borderRadius: 6 },
  actions: { display: "flex", gap: 8, marginTop: 8 },
  btn: { padding: "8px 14px", borderRadius: 6, cursor: "pointer" },
  deleteBtn: { padding: "8px 14px", borderRadius: 6, cursor: "pointer", color: "#b00020" },
  result: { marginTop: 24, padding: 16, border: "1px solid #eee", borderRadius: 8 },
  meta: { color: "#555", fontSize: 14, margin: "4px 0" },
  receiptImage: { maxWidth: "100%", maxHeight: 320, borderRadius: 8, border: "1px solid #eee", margin: "8px 0" },
  missed: { color: "#b00020", fontWeight: 600 },
  ok: { color: "#0a7d33", fontWeight: 600 },
  error: { color: "#b00020" },
};
