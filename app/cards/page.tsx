"use client";

// Card management — Section 2 (Card Management). Browse the researched catalog,
// add cards from it (never typing rates), list + remove your saved cards.
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/ui/errors";
import type { CatalogCardDTO, UserCardDTO } from "@/lib/api/types";

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
    <main style={styles.wrap}>
      <h1>Cards</h1>
      {error && <p role="alert" style={styles.error}>{error}</p>}

      <section>
        <h2>Your cards</h2>
        {loading ? (
          <p>Loading…</p>
        ) : myCards.length === 0 ? (
          <p>No cards yet. Add one from the catalog below.</p>
        ) : (
          <ul style={styles.list}>
            {myCards.map((c) => (
              <li key={c.id} style={styles.row}>
                <span>{c.nickname ?? c.cardCatalogId}</span>
                <button onClick={() => remove(c.id)} style={styles.smallBtn}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Catalog</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadCatalog(search);
          }}
          style={styles.searchRow}
        >
          <input
            placeholder="Search issuer or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.smallBtn}>Search</button>
        </form>
        <ul style={styles.list}>
          {catalog.map((c) => {
            const already = savedCatalogIds.has(c.id);
            return (
              <li key={c.id} style={styles.row}>
                <span>
                  {c.issuer} {c.productName} <em style={styles.muted}>({c.network})</em>
                </span>
                <button
                  onClick={() => add(c.id)}
                  disabled={already}
                  style={styles.smallBtn}
                >
                  {already ? "Added" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: "system-ui", maxWidth: 720, margin: "32px auto", padding: 24 },
  list: { listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 8, border: "1px solid #eee", borderRadius: 6 },
  searchRow: { display: "flex", gap: 8, marginBottom: 12 },
  input: { padding: 8, fontSize: 15, border: "1px solid #ccc", borderRadius: 6, flex: 1 },
  smallBtn: { padding: "6px 12px", borderRadius: 6, cursor: "pointer" },
  muted: { color: "#666", fontStyle: "normal", fontSize: 13 },
  error: { color: "#b00020" },
};
