import type { ReactNode } from "react";
import styles from "./Feedback.module.css";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className={styles.spinnerWrap} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.spinnerLabel}>{label}</span>
    </div>
  );
}

/** Inline error banner (uses the "missed" red only for genuine errors). */
export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className={styles.error}>
      {children}
    </div>
  );
}
