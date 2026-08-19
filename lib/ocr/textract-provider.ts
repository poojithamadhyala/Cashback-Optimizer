/**
 * TextractOcrProvider — AWS Textract AnalyzeExpense (Section 8).
 *
 * Textract's AnalyzeExpense returns structured fields (VENDOR_NAME, TOTAL,
 * INVOICE_RECEIPT_DATE) directly, which is why the spec chose it over
 * general OCR + regex (Section 8).
 *
 * ⚠️ NOT EXECUTABLE IN THIS SANDBOX: network mode is INTEGRATIONS_ONLY, so the
 * live AWS call cannot be tested here. The real call is written below but the
 * client import + invocation are COMMENTED OUT so the file type-checks and the
 * app builds without the AWS SDK present. Uncomment + `npm i @aws-sdk/client-textract`
 * in a networked environment to enable.
 */

import type { OcrProvider, OcrResult } from "./types.ts";

// import {
//   TextractClient,
//   AnalyzeExpenseCommand,
//   type ExpenseField,
// } from "@aws-sdk/client-textract";

export class TextractOcrProvider implements OcrProvider {
  readonly name = "textract";

  constructor(private readonly region = process.env.AWS_REGION ?? "us-east-1") {}

  async analyze(image: Uint8Array, _mimeType: string): Promise<OcrResult> {
    // ---- REAL IMPLEMENTATION (commented out; requires AWS network + SDK) ----
    //
    // const client = new TextractClient({ region: this.region });
    // const out = await client.send(
    //   new AnalyzeExpenseCommand({ Document: { Bytes: image } })
    // );
    //
    // const doc = out.ExpenseDocuments?.[0];
    // const fields: ExpenseField[] = doc?.SummaryFields ?? [];
    //
    // const pick = (type: string): { value: string | null; conf: number } => {
    //   const f = fields.find((x) => x.Type?.Text === type);
    //   return {
    //     value: f?.ValueDetection?.Text ?? null,
    //     conf: (f?.ValueDetection?.Confidence ?? 0) / 100, // Textract is 0..100
    //   };
    // };
    //
    // const vendor = pick("VENDOR_NAME");
    // const total = pick("TOTAL");
    // const date = pick("INVOICE_RECEIPT_DATE");
    //
    // // Overall confidence = min of the fields we actually depend on.
    // const confidence = Math.min(vendor.conf, total.conf, date.conf);
    //
    // return {
    //   merchantRaw: vendor.value,
    //   date: normalizeDate(date.value),
    //   total: parseAmount(total.value),
    //   confidence,
    //   rawText: JSON.stringify(doc ?? {}),
    // };
    //
    // ------------------------------------------------------------------------

    throw new Error(
      "TextractOcrProvider is not enabled in this environment. " +
        "Install @aws-sdk/client-textract, provide AWS credentials, and " +
        "uncomment the implementation. Use OCR_PROVIDER=mock for local/offline dev."
    );
  }
}

// Helpers the real implementation would use (kept for reference).
//
// function parseAmount(s: string | null): number | null {
//   if (!s) return null;
//   const cleaned = s.replace(/[^0-9.]/g, "");
//   const n = Number.parseFloat(cleaned);
//   return Number.isFinite(n) ? n : null;
// }
//
// function normalizeDate(s: string | null): string | null {
//   if (!s) return null;
//   const d = new Date(s);
//   return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
// }
