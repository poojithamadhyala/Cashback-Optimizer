// GET    /receipts/:id  — fetch one receipt (owner only)
// PATCH  /receipts/:id  — confirm/edit needs_review data; on confirm, runs the
//                         rewards engine and persists a calc snapshot.
// DELETE /receipts/:id  — delete a receipt (owner only)
// Section 5, governed by Section 2 (Receipt Upload & OCR + data isolation),
// Section 3 (versioning), Section 4.3 (engine). Wired to the tested service.
import { errorResponse, json, parseJson } from "@/lib/http";
import { requirePrincipal } from "@/lib/auth/authz";
import { getCurrentPrincipal } from "@/lib/auth/current-user";
import {
  getReceipt,
  confirmReceipt,
  deleteReceipt,
  type ConfirmInput,
} from "@/lib/receipts/service";
import { buildReceiptDeps } from "@/lib/receipts/deps";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const principal = requirePrincipal(await getCurrentPrincipal());
    const { id } = await ctx.params;
    const receipt = await getReceipt(buildReceiptDeps(), principal, id);
    return json({ receipt });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const principal = requirePrincipal(await getCurrentPrincipal());
    const { id } = await ctx.params;
    const body = (await parseJson(req)) as ConfirmInput | null;
    const result = await confirmReceipt(buildReceiptDeps(), principal, id, body ?? {});
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const principal = requirePrincipal(await getCurrentPrincipal());
    const { id } = await ctx.params;
    await deleteReceipt(buildReceiptDeps(), principal, id);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
