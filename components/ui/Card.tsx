import type { ReactNode, CSSProperties } from "react";
import styles from "./Card.module.css";

export function Card({
  children,
  className = "",
  style,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padded?: boolean;
}) {
  return (
    <div
      className={[styles.card, padded ? styles.padded : "", className].filter(Boolean).join(" ")}
      style={style}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className={styles.header}>{children}</div>;
}
