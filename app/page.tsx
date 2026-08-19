import Link from "next/link";

// Home / landing. Links into the app flows (Section 7 step 8).
export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 32, maxWidth: 720, margin: "0 auto" }}>
      <h1>Loyalty &amp; Cashback Optimizer</h1>
      <p>
        Scan receipts and find out whether you used the optimal card — and which
        card you should have used — based on researched reward-rate data.
      </p>
      <nav style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 24 }}>
        <Link href="/login">Log in</Link>
        <Link href="/signup">Sign up</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/cards">Cards</Link>
        <Link href="/receipts">Receipts</Link>
      </nav>
      <p style={{ marginTop: 32, color: "#666", fontSize: 13 }}>
        Note: the rewards engine, auth, card CRUD, receipt flow, and dashboard
        aggregation are implemented and unit-tested. See <code>README.md</code>{" "}
        for what is verified vs. pending (e.g. these pages are written but not yet
        rendered in a browser in the build environment).
      </p>
    </main>
  );
}
