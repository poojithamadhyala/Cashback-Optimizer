/**
 * Pure date helper, isolated from any I/O imports so it is unit-testable offline
 * (importing it must not pull in Prisma or the OCR factory).
 */

/** Compute the calendar quarter string like "2026-Q3" from a date (UTC). */
export function quarterOf(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${q}`;
}
