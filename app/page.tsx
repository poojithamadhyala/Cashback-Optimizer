import Link from "next/link";
import { Button } from "@/components/ui/Button";
import styles from "./landing.module.css";

// Marketing landing. The app nav is hidden here (see AppNav).
export default function HomePage() {
  return (
    <main className={styles.wrap}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Receipts in, smarter spending out</span>
        <h1 className={styles.title}>
          Know if you used the <span className={styles.accent}>right card</span> —
          every time.
        </h1>
        <p className={styles.sub}>
          Scan a receipt and we&apos;ll tell you what you earned, what the best
          card in your wallet would have earned, and exactly how much you left on
          the table — using researched, up-to-date reward rates.
        </p>
        <div className={styles.cta}>
          <Link href="/signup">
            <Button size="md">Get started free</Button>
          </Link>
          <Link href="/login">
            <Button size="md" variant="secondary">
              Log in
            </Button>
          </Link>
        </div>
      </section>

      <section className={styles.features}>
        <Feature
          title="Deterministic math, not guesses"
          body="Rewards are computed by tested code — same inputs, same answer — accounting for caps, rotating categories, and points-vs-cashback."
        />
        <Feature
          title="Your history stays accurate"
          body="Each calculation snapshots the rules it used, so updating a card later never rewrites your past numbers."
        />
        <Feature
          title="Nothing saved on a guess"
          body="Low-confidence scans go to “Needs review” instead of silently entering wrong data into your totals."
        />
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.feature}>
      <div className={styles.featureDot} aria-hidden="true" />
      <h3>{title}</h3>
      <p className="text-muted">{body}</p>
    </div>
  );
}
