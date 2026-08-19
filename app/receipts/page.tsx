"use client";

// Receipts list + upload — Section 2 (Receipt Upload & OCR). Uploading kicks off
// OCR server-side; low-confidence/missing-field receipts land in "Needs review".
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/ui/errors";
import { statusLabel, categoryLabel, formatCurrency } from "@/lib/ui/format";
import type { ReceiptDTO } from "@/lib/api/types";

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await api.listReceipts();
    if (res.ok) setReceipts(res.data.receipts);
    else setError(errorMessage(res.error));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("image") as HTMLInputElement;
    if (!fileInput.files?.[0]) {
      setError("Please choose an image.");
      return;
    }
    const fd = new FormData();
    fd.append("image", fileInput.files[0]);
    setUploading(true);
    const res = await api.uploadReceipt(fd);
    setUploading(false);
    if (res.ok) {
      form.reset();
      await load();
    } else {
      setError(errorMessage(res.error));
    }
  }

  const needsReview = receipts.filter((r) => r.status === "needs_review");
  const confirmed = receipts.filter((r) => r.status === "confirmed");

  return (
    <main style={styles.wrap}>
      <h1>Receipts</h1>
      {error && <p role="alert" style={styles.error}>{error}</p>}

      <form onSubmit={onUpload} style={styles.uploadRow}>
        <input type="file" name="image" accept="image/*" />
        <button type="submit" disabled={uploading} style={styles.btn}>
          {uploading ? "Uploading…" : "Upload receipt"}
        </button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <Section title={`Needs review (${needsReview.length})`} rows={needsReview} />
          <Section title={`Confirmed (${confirmed.length})`} rows={confirmed} />
        </>
      )}
    </main>
  );
}

function Section({ title, rows }: { title: string; rows: ReceiptDTO[] }) {
  return (
    <section>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p style={styles.muted}>None.</p>
      ) : (
        <ul style={styles.list}>
          {rows.map((r) => (
            <li key={r.id} style={styles.item}>
              <Link href={`/receipts/${r.id}`} style={styles.link}>
                <strong>{r.merchantNormalized ?? r.merchantRaw ?? "Unknown merchant"}</strong>
                <span style={styles.meta}>
                  {categoryLabel(r.category)} ·{" "}
                  {r.totalAmount != null ? formatCurrency(r.totalAmount) : "—"} ·{" "}
                  {statusLabel(r.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: "system-ui", maxWidth: 720, margin: "32px auto", padding: 24 },
  uploadRow: { display: "flex", gap: 8, alignItems: "center", margin: "16px 0 24px" },
  btn: { padding: "8px 14px", borderRadius: 6, cursor: "pointer" },
  list: { listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 },
  item: { border: "1px solid #eee", borderRadius: 6 },
  link: { display: "flex", flexDirection: "column", gap: 4, padding: 12, textDecoration: "none", color: "inherit" },
  meta: { color: "#555", fontSize: 13 },
  muted: { color: "#666" },
  error: { color: "#b00020" },
};
