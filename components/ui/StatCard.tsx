import styles from "./StatCard.module.css";

type Tone = "default" | "earned" | "missed";

export function StatCard({
  label,
  value,
  tone = "default",
  sub,
}: {
  label: string;
  value: string;
  tone?: Tone;
  sub?: string;
}) {
  return (
    <div className={[styles.stat, styles[tone]].join(" ")}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
}
