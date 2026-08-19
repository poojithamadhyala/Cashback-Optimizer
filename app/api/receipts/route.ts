// POST /receipts        — upload receipt image, kick off OCR (Section 2, 4.1)
// GET  /receipts?status= — list current user's receipts, optional status filter
// Section 5, governed by Section 2 (Receipt Upload & OCR) + Section 4.1.
//
// Wired to the unit-tested receipt service. The OCR call, storage, and Prisma
// I/O run only in the Next.js server runtime; the routing/needs_review decision,
// categorization, and validation are all covered by unit tests.
import { errorResponse, json } from "@/lib/http";
import { requirePrincipal } from "@/lib/auth/authz";
import { getCurrentPrincipal } from "@/lib/auth/current-user";
import { uploadReceipt, listReceipts, type ReceiptStatus } from "@/lib/receipts/service";
import { buildReceiptDeps } from "@/lib/receipts/deps";
import { getObjectStorage } from "@/lib/storage";

export async function POST(req: Request): Promise<Response> {
  try {
    const principal = requirePrincipal(await getCurrentPrincipal());
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return json({ error: "validation", message: "image file required" }, 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());

    // Persist the image bytes to object storage (dev: local disk; prod: S3).
    // Bytes are really written — see lib/storage/local-disk.ts.
    const stored = await getObjectStorage().put(bytes, file.type);
    const imageUrl: string | null = stored.url;

    const deps = buildReceiptDeps();
    const receipt = await uploadReceipt(deps, principal, bytes, file.type, imageUrl);
    return json({ receipt }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(req: Request): Promise<Response> {
  try {
    const principal = requirePrincipal(await getCurrentPrincipal());
    const statusParam = new URL(req.url).searchParams.get("status") ?? undefined;
    const status =
      statusParam === "needs_review" || statusParam === "confirmed"
        ? (statusParam as ReceiptStatus)
        : undefined;
    const deps = buildReceiptDeps();
    const receipts = await listReceipts(deps, principal, status);
    return json({ receipts });
  } catch (err) {
    return errorResponse(err);
  }
}
