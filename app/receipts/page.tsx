"use client";

// Receipts list + upload — Section 2 (Receipt Upload & OCR). Uploading kicks off
// OCR server-side; low-confidence/missing-field receipts land in "Needs review".
// Data logic unchanged from pre-restyle — only markup/styles.
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/ui/errors";
import { categoryLabel, formatCurrency } from "@/lib/ui/format";
import type { ReceiptDTO } from "@/lib/api/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner, ErrorBanner } from "@/components/ui/Feedback";
import styles from "./receipts.module.css";

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

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
    <main className="page stack">
      <div>
        <h1>Receipts</h1>
        <p className="text-muted">
          Upload a receipt photo. We extract merchant, date, and total — anything
          uncertain lands in <strong>Needs review</strong> so nothing wrong enters
          your totals.
        </p>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card>
        <form onSubmit={onUpload} className={styles.uploadRow}>
          <input
            ref={fileRef}
            type="file"
            name="image"
            accept="image/*"
            className={styles.file}
          />
          <Button type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload receipt"}
          </Button>
        </form>
      </Card>

      {loading ? (
        <Spinner label="Loading receipts…" />
      ) : (
        <>
          <Section
            title="Needs review"
            count={needsReview.length}
            rows={needsReview}
            emptyMsg="Nothing waiting — nice."
          />
          <Section
            title="Confirmed"
            count={confirmed.length}
            rows={confirmed}
            emptyMsg="No confirmed receipts yet."
          />
        </>
      )}
    </main>
  );
}

function Section({
  title,
  count,
  rows,
  emptyMsg,
}: {
  title: string;
  count: number;
  rows: ReceiptDTO[];
  emptyMsg: string;
}) {
  return (
    <section>
      <h2>
        {title} <span className={styles.count}>{count}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted">{emptyMsg}</p>
      ) : (
        <div className={styles.list}>
          {rows.map((r) => (
            <Link key={r.id} href={`/receipts/${r.id}`} className={styles.rowLink}>
              <Card className={styles.row}>
                <div>
                  <div className={styles.merchant}>
                    {r.merchantNormalized ?? r.merchantRaw ?? "Unknown merchant"}
                  </div>
                  <div className={styles.meta}>
                    {categoryLabel(r.category)} ·{" "}
                    {r.totalAmount != null ? formatCurrency(r.totalAmount) : "—"}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
