"use client";

// Dashboard — Section 2 (Dashboard). Total missed rewards over time, per-category
// breakdown, and the "best card per category" cheat sheet from saved cards.
// Only confirmed receipts contribute to totals (enforced server-side).
// Data logic unchanged from pre-restyle — only markup/styles.
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/ui/errors";
import { formatCurrency, formatPct, categoryLabel } from "@/lib/ui/format";
import type { DashboardSummaryDTO, CheatsheetRowDTO } from "@/lib/api/types";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Spinner, ErrorBanner } from "@/components/ui/Feedback";
import styles from "./dashboard.module.css";

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

  if (loading)
    return (
      <main className="page">
        <Spinner label="Loading your dashboard…" />
      </main>
    );

  return (
    <main className="page stack">
      <div>
        <h1>Dashboard</h1>
        <p className="text-muted">
          Your rewards at a glance. Only confirmed receipts count toward totals.
        </p>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {summary && (
        <>
          <section className={styles.stats}>
            <StatCard
              label="Total missed"
              value={formatCurrency(summary.totalMissed)}
              tone="missed"
              sub="Rewards left on the table"
            />
            <StatCard
              label="Earned"
              value={formatCurrency(summary.totalActualCashback)}
              tone="earned"
            />
            <StatCard label="Best possible" value={formatCurrency(summary.totalOptimalCashback)} />
            <StatCard label="Receipts" value={String(summary.receiptCount)} />
          </section>

          <section>
            <h2>Missed by category</h2>
            {summary.byCategory.length === 0 ? (
              <EmptyState
                title="No confirmed receipts yet"
                action={
                  <Link href="/receipts">
                    <Button>Upload a receipt</Button>
                  </Link>
                }
              >
                Once you confirm a receipt, your per-category breakdown shows up here.
              </EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Missed</th>
                    <th className="num">Earned</th>
                    <th className="num">Best</th>
                    <th className="num">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCategory.map((row) => (
                    <tr key={row.category}>
                      <td>{categoryLabel(row.category)}</td>
                      <td className="num">
                        <span className={row.missedAmount > 0 ? "text-missed" : undefined}>
                          {formatCurrency(row.missedAmount)}
                        </span>
                      </td>
                      <td className="num">{formatCurrency(row.actualCashback)}</td>
                      <td className="num">{formatCurrency(row.optimalCashback)}</td>
                      <td className="num">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
        </>
      )}

      <section>
        <h2>Best card per category</h2>
        {cheatsheet.length === 0 ? (
          <EmptyState
            title="No cheat sheet yet"
            action={
              <Link href="/cards">
                <Button variant="secondary">Manage cards</Button>
              </Link>
            }
          >
            Add the cards you carry and we&apos;ll show the best one to use in each
            category.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Best card</th>
                <th className="num">Rate</th>
              </tr>
            </thead>
            <tbody>
              {cheatsheet.map((row) => (
                <tr key={row.category}>
                  <td>{categoryLabel(row.category)}</td>
                  <td>{row.bestCardLabel ?? "—"}</td>
                  <td className="num">
                    {row.bestCardId ? (
                      <span className="text-earned" style={{ fontWeight: 600 }}>
                        {formatPct(row.effectiveRatePct)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </main>
  );
}
