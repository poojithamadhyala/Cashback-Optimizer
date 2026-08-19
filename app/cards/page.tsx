"use client";

// Card management — Section 2 (Card Management). Browse the researched catalog,
// add cards from it (never typing rates), list + remove your saved cards.
// Data logic unchanged from pre-restyle — only markup/styles updated.
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/ui/errors";
import type { CatalogCardDTO, UserCardDTO } from "@/lib/api/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner, ErrorBanner } from "@/components/ui/Feedback";
import styles from "./cards.module.css";

export default function CardsPage() {
  const [catalog, setCatalog] = useState<CatalogCardDTO[]>([]);
  const [myCards, setMyCards] = useState<UserCardDTO[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMyCards = useCallback(async () => {
    const res = await api.getMyCards();
    if (res.ok) setMyCards(res.data.cards);
    else setError(errorMessage(res.error));
  }, []);

  const loadCatalog = useCallback(async (q?: string) => {
    const res = await api.getCatalog(q);
    if (res.ok) setCatalog(res.data.cards);
    else setError(errorMessage(res.error));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadCatalog(), loadMyCards()]);
      setLoading(false);
    })();
  }, [loadCatalog, loadMyCards]);

  async function add(cardCatalogId: string) {
    setError(null);
    const res = await api.addCard(cardCatalogId);
    if (res.ok) await loadMyCards();
    else setError(errorMessage(res.error));
  }

  async function remove(id: string) {
    setError(null);
    const res = await api.removeCard(id);
    if (res.ok) await loadMyCards();
    else setError(errorMessage(res.error));
  }

  const savedCatalogIds = new Set(myCards.map((c) => c.cardCatalogId));

  return (
    <main className="page stack">
      <div>
        <h1>Your cards</h1>
        <p className="text-muted">
          Add the cards you actually carry. We only use researched rates from the
          catalog — you never type your own.
        </p>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <section>
        <h2>Wallet</h2>
        {loading ? (
          <Spinner />
        ) : myCards.length === 0 ? (
          <EmptyState title="No cards yet">
            Add one from the catalog below to start comparing rewards.
          </EmptyState>
        ) : (
          <div className={styles.grid}>
            {myCards.map((c) => (
              <Card key={c.id} className={styles.walletCard}>
                <div className={styles.walletTop}>
                  <span className={styles.chip} aria-hidden="true" />
                  <Badge tone="earned">Active</Badge>
                </div>
                <div className={styles.walletName}>{c.nickname ?? c.cardCatalogId}</div>
                <Button variant="danger" size="sm" onClick={() => remove(c.id)}>
                  Remove
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Catalog</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadCatalog(search);
          }}
          className={styles.searchRow}
        >
          <Input
            placeholder="Search issuer or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <div className={styles.catalogList}>
          {catalog.map((c) => {
            const already = savedCatalogIds.has(c.id);
            return (
              <Card key={c.id} className={styles.catalogRow}>
                <div>
                  <div className={styles.catalogName}>
                    {c.issuer} {c.productName}
                  </div>
                  <div className={styles.catalogMeta}>
                    <Badge tone="neutral">{c.network}</Badge>
                  </div>
                </div>
                <Button
                  onClick={() => add(c.id)}
                  disabled={already}
                  variant={already ? "secondary" : "primary"}
                  size="sm"
                >
                  {already ? "Added" : "Add"}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}
