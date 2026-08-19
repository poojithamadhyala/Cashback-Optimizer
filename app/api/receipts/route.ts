// POST /receipts        — upload receipt image, kick off OCR (Section 2, 4.1)
// GET  /receipts?status= — list current user's receipts, optional status filter
// Section 5, governed by Section 2 (Receipt Upload & OCR) + Section 4.1 (OCR service).
//
// POST flow when implemented:
//   1. requireUser
//   2. read multipart image; persist to storage; set imageUrl
//   3. ocr = getOcrProvider().analyze(bytes, mime)   (lib/ocr)
//   4. decision = routeReceipt(ocr, getConfidenceThreshold())  (pure, tested)
//   5. create Receipt with status = decision.status; ocrConfidence, ocrRawText
//      - needs_review receipts DO NOT factor into dashboard totals (Section 2)
//   6. run categorizer on merchantRaw (Section 4.2); null category => Uncategorized
// GET: scope to session user; filter by status if provided.
import { notImplemented } from "@/lib/http";

export async function POST(): Promise<Response> {
  return notImplemented(
    "Section 2 (Receipt Upload & OCR), Section 4.1 (OCR service)",
    "Auth-gate; store image; run getOcrProvider().analyze; routeReceipt() decides needs_review vs confirmed; persist."
  );
}

export async function GET(): Promise<Response> {
  return notImplemented(
    "Section 2 (Receipt Upload & OCR)",
    "Auth-gate; return receipts WHERE userId = session user, optional ?status= filter."
  );
}
