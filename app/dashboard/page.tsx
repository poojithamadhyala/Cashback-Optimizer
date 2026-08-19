"use client";

// Dashboard — Section 2 (Dashboard). Total missed rewards over time, per-category
// breakdown, and the "best card per category" cheat sheet from saved cards.
// Only confirmed receipts contribute to totals (enforced server-side).
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/ui/errors";
import { formatCurrency, formatPct, categoryLabel } from "@/lib/ui/format";
import type { DashboardSummaryDTO, CheatsheetRowDTO } from "@/lib/api/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryDTO | null>(null);
  const [cheatsheet, setCheatsheet] = useState<CheatsheetRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, c] = await Promise.all([api.getSummary(), api.getCheatsheet()]);
      if (s.ok) setSummary(s.data.summary);
      else setError(errorMessage(s.error));
      if (c.ok) setCheatsheet(c.data.cheatsheet);
      setLoading(false);
    })();
  }, []);

  if (loading) return <main style={styles.wrap}><p>Loading…</p></main>;

  return (
    <main style={styles.wrap}>
      <h1>Dashboard</h1>
      {error && <p role="alert" style={styles.error}>{error}</p>}

      {summary && (
        <>
          <section style={styles.cards}>
            <Stat label="Total missed" value={formatCurrency(summary.totalMissed)} highlight />
            <Stat label="Earned" value={formatCurrency(summary.totalActualCashback)} />
            <Stat label="Best possible" value={formatCurrency(summary.totalOptimalCashback)} />
            <Stat label="Receipts" value={String(summary.receiptCount)} />
          </section>

          <section>
            <h2>Missed by category</h2>
            {summary.byCategory.length === 0 ? (
              <p style={styles.muted}>
                No confirmed receipts yet. <Link href="/receipts">Upload one →</Link>
              </p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Category</th>
                    <th style={styles.thR}>Missed</th>
                    <th style={styles.thR}>Earned</th>
                    <th style={styles.thR}>Best</th>
                    <th style={styles.thR}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCategory.map((row) => (
                    <tr key={row.category}>
                      <td style={styles.td}>{categoryLabel(row.category)}</td>
                      <td style={styles.tdR}>{formatCurrency(row.missedAmount)}</td>
                      <td style={styles.tdR}>{formatCurrency(row.actualCashback)}</td>
                      <td style={styles.tdR}>{formatCurrency(row.optimalCashback)}</td>
                      <td style={styles.tdR}>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      <section>
        <h2>Best card per category</h2>
        {cheatsheet.length === 0 ? (
          <p style={styles.muted}>
            Add cards to see your cheat sheet. <Link href="/cards">Manage cards →</Link>
          </p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Best card</th>
                <th style={styles.thR}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {cheatsheet.map((row) => (
                <tr key={row.category}>
                  <td style={styles.td}>{categoryLabel(row.category)}</td>
                  <td style={styles.td}>{row.bestCardLabel ?? "—"}</td>
                  <td style={styles.tdR}>{row.bestCardId ? formatPct(row.effectiveRatePct) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ ...styles.stat, ...(highlight ? styles.statHighlight : {}) }}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: "system-ui", maxWidth: 820, margin: "32px auto", padding: 24 },
  cards: { display: "flex", gap: 12, flexWrap: "wrap", margin: "16px 0 24px" },
  stat: { flex: "1 1 140px", padding: 16, border: "1px solid #eee", borderRadius: 8 },
  statHighlight: { borderColor: "#b00020", background: "#fff5f5" },
  statLabel: { fontSize: 13, color: "#666" },
  statValue: { fontSize: 24, fontWeight: 700 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", borderBottom: "2px solid #eee", padding: "8px 6px" },
  thR: { textAlign: "right", borderBottom: "2px solid #eee", padding: "8px 6px" },
  td: { textAlign: "left", borderBottom: "1px solid #f0f0f0", padding: "8px 6px" },
  tdR: { textAlign: "right", borderBottom: "1px solid #f0f0f0", padding: "8px 6px" },
  muted: { color: "#666" },
  error: { color: "#b00020" },
};
