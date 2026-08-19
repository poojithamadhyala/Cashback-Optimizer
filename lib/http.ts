/**
 * Small HTTP helpers shared by route handlers.
 *
 * notImplemented() is the honest placeholder for every stubbed endpoint: it
 * returns 501 with a pointer to the governing spec section, so the scaffold is
 * runnable and self-documenting but never pretends to work.
 */

import { NextResponse } from "next/server";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function notImplemented(specRef: string, todo: string): NextResponse {
  return NextResponse.json(
    {
      error: "not_implemented",
      specRef,
      todo,
      note:
        "Scaffold stub. The rewards engine (lib/rewards-engine.ts) is fully " +
        "implemented and tested; this HTTP layer is intentionally not wired yet.",
    },
    { status: 501 }
  );
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
