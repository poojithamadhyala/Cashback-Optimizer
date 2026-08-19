/**
 * OCR service interface — Section 4.1.
 *
 * "image in, {merchant_raw, date, total, confidence, raw_text} out.
 *  Swappable implementation behind an interface."
 *
 * The engine that consumes this (receipt upload flow, Section 2) uses the
 * confidence score + presence of required fields to decide needs_review vs
 * confirmed. That branching logic lives in lib/ocr/route-receipt.ts so it is
 * unit-testable independent of any real OCR backend.
 */

export interface OcrResult {
  /** Raw merchant/vendor string as read from the receipt (may be null). */
  merchantRaw: string | null;
  /** Purchase date as ISO string YYYY-MM-DD (may be null if not found). */
  date: string | null;
  /** Total amount in dollars (may be null if not found). */
  total: number | null;
  /** Confidence in [0, 1]. Lower => route to needs_review. */
  confidence: number;
  /** Full raw text (or provider dump) for audit / manual review. */
  rawText: string;
}

export interface OcrProvider {
  /** Provider identifier, for logging/debugging. */
  readonly name: string;
  /**
   * Extract structured fields from a receipt image.
   * @param image raw image bytes
   * @param mimeType e.g. "image/jpeg"
   */
  analyze(image: Uint8Array, mimeType: string): Promise<OcrResult>;
}
