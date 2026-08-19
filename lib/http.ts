/**
 * Small HTTP helpers shared by route handlers. Errors are translated centrally
 * by errorResponse(); routes throw typed AppErrors rather than building status
 * responses by hand.
 */

import { NextResponse } from "next/server";
import { AppError, statusFor } from "./errors.ts";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Convert a thrown error into an HTTP response. AppError maps to its status
 * code + kind; anything else becomes an opaque 500 (never leak internals).
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.kind, message: err.message, details: err.details },
      { status: statusFor(err.kind) }
    );
  }
  // Do not leak internal error text to clients.
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

/** Safely parse a JSON request body, returning null on failure. */
export async function parseJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

