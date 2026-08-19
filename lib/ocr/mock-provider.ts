/**
 * MockOcrProvider — offline-safe default (Section 4.1, swappable interface).
 *
 * SAFE DEFAULT: returns low confidence and null fields so every receipt routes
 * to `needs_review` (Section 2: "never silently saved with guessed data").
 * This is the correct conservative behavior when no real OCR backend is wired.
 *
 * For tests, a canned result can be injected so the confidence-threshold
 * branching (route-receipt.ts) can be exercised deterministically without a
 * real OCR model — exactly what Section 6 (OCR pipeline) requires.
 */

import type { OcrProvider, OcrResult } from "./types.ts";

export class MockOcrProvider implements OcrProvider {
  readonly name = "mock";
  private readonly canned?: Partial<OcrResult>;

  constructor(canned?: Partial<OcrResult>) {
    this.canned = canned;
  }

  async analyze(_image: Uint8Array, _mimeType: string): Promise<OcrResult> {
    // Default: everything null + 0 confidence => guaranteed needs_review.
    const base: OcrResult = {
      merchantRaw: null,
      date: null,
      total: null,
      confidence: 0,
      rawText: "[mock-ocr] no real OCR backend configured; routed to needs_review",
    };
    return { ...base, ...this.canned };
  }
}
