import Link from "next/link";
import styles from "./landing.module.css";

// Marketing landing (dark navy + neon-green). The app's AppNav is hidden on "/",
// so this page ships its own sticky marketing nav. Content is kept HONEST to
// what the product actually does — no invented bank features.
export default function HomePage() {
  return (
    <div className={styles.root}>
      {/* Sticky marketing nav */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">◎</span>
            <span>Cashback&nbsp;Optimizer</span>
          </Link>
          <nav className={styles.navLinks}>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#cards">Cards</a>
            <Link href="/login" className={styles.signIn}>
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Receipts in, smarter spending out</span>
          <h1 className={styles.title}>
            You&apos;re leaving cashback
            <br />
            <span className={styles.accent}>on the table.</span> We&apos;ll prove it.
          </h1>
          <p className={styles.sub}>
            Scan a receipt and see exactly what you earned, what the best card in
            your wallet <em>would</em> have earned, and the difference — computed
            from researched, up-to-date reward rates. No guesswork, no fluff.
          </p>
          <div className={styles.cta}>
            <Link href="/signup" className={styles.ctaPrimary}>
              Get started free
              <span aria-hidden="true">→</span>
            </Link>
            <a href="#how" className={styles.ctaGhost}>
              See how it works
            </a>
          </div>
          <div className={styles.trustRow}>
            <span className={styles.trustDot} aria-hidden="true" />
            Deterministic math · your history never silently changes
          </div>
        </div>

        {/* Pure-CSS 3D card mockup */}
        <div className={styles.cardStage} aria-hidden="true">
          <div className={styles.card3d}>
            <div className={styles.cardSheen} />
            <div className={styles.cardTop}>
              <span className={styles.cardBrand}>◎ OPTIMIZER</span>
              <span className={styles.cardTier}>REWARDS</span>
            </div>
            <div className={styles.cardChip} />
            <div className={styles.cardNumber}>
              <span>4829</span>
              <span>••••</span>
              <span>••••</span>
              <span>7310</span>
            </div>
            <div className={styles.cardFoot}>
              <div>
                <div className={styles.cardLabel}>BEST FOR</div>
                <div className={styles.cardValue}>Dining · Travel</div>
              </div>
              <div className={styles.cardEarned}>+$1,240 / yr</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className={styles.section}>
        <h2 className={styles.sectionTitle}>Three steps. Real numbers.</h2>
        <div className={styles.steps}>
          <Step n="1" title="Scan a receipt">
            Upload a photo. We extract merchant, date, and total — anything
            uncertain waits in “Needs review” instead of guessing.
          </Step>
          <Step n="2" title="Pick the card you used">
            Choose from the cards in your wallet. We map the merchant to a
            spending category automatically.
          </Step>
          <Step n="3" title="See what you missed">
            We compare every card you own and show the exact cashback delta —
            down to the cent.
          </Step>
        </div>
      </section>

      {/* Feature grid — honest, real capabilities */}
      <section id="features" className={styles.section}>
        <h2 className={styles.sectionTitle}>Built to be trusted with your money</h2>
        <div className={styles.grid}>
          <Feature title="Deterministic rewards math">
            Every calculation is tested code — same inputs, same answer — handling
            caps, rotating categories, and points-vs-cashback correctly.
          </Feature>
          <Feature title="History that never drifts">
            Each result snapshots the exact rules it used, so updating a card
            later never rewrites your past numbers.
          </Feature>
          <Feature title="Never saved on a guess">
            Low-confidence scans route to review, so wrong data never quietly
            lands in your totals.
          </Feature>
          <Feature title="Researched, real card rates">
            Rates come from a verified catalog with sources and dates — not
            numbers you have to type in yourself.
          </Feature>
        </div>
      </section>

      {/* Cards teaser */}
      <section id="cards" className={styles.ctaBand}>
        <h2 className={styles.bandTitle}>Find out what your wallet is really worth.</h2>
        <p className={styles.bandSub}>
          Add your cards, scan a receipt, and get your first “missed rewards”
          number in minutes.
        </p>
        <Link href="/signup" className={styles.ctaPrimary}>
          Get started free
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <footer className={styles.footer}>
        <span>◎ Cashback Optimizer</span>
        <span className={styles.footerMuted}>
          Deterministic rewards, honest history.
        </span>
      </footer>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className={styles.step}>
      <div className={styles.stepNum}>{n}</div>
      <h3 className={styles.stepTitle}>{title}</h3>
      <p className={styles.stepBody}>{children}</p>
    </div>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.feature}>
      <div className={styles.featureDot} aria-hidden="true" />
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureBody}>{children}</p>
    </div>
  );
}
