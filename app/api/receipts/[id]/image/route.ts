// GET /receipts/:id/image — stream the stored receipt image bytes.
// Section 2 (data isolation): ownership-checked via getReceipt (403/404) so a
// user cannot fetch another user's receipt image by guessing an id.
//
// The receipt row stores image_url as a storage reference (e.g. "local://<key>").
// A browser cannot load that scheme directly, so this route resolves the key and
// streams the bytes with the right content type.
import { errorResponse } from "@/lib/http";
import { requirePrincipal } from "@/lib/auth/authz";
import { getCurrentPrincipal } from "@/lib/auth/current-user";
import { getReceipt } from "@/lib/receipts/service";
import { buildReceiptDeps } from "@/lib/receipts/deps";
import { getObjectStorage, parseStorageRef } from "@/lib/storage";
import { NotFound } from "@/lib/errors";

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const principal = requirePrincipal(await getCurrentPrincipal());
    const { id } = await ctx.params;

    // Ownership + existence enforced here (throws 403/404 as appropriate).
    const receipt = await getReceipt(buildReceiptDeps(), principal, id);

    const ref = parseStorageRef(receipt.imageUrl);
    if (!ref) throw NotFound("no image for this receipt");

    const bytes = await getObjectStorage().get(ref.key);
    const ext = ref.key.split(".").pop()?.toLowerCase() ?? "";
    const contentType = EXT_MIME[ext] ?? "application/octet-stream";

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
