/**
 * Typed application errors. Route handlers map these to HTTP status codes,
 * keeping the service/business layer HTTP-agnostic and testable.
 */

export type AppErrorKind =
  | "unauthorized" // 401 — not authenticated
  | "forbidden" // 403 — authenticated but not allowed (ownership)
  | "not_found" // 404
  | "validation" // 400
  | "conflict"; // 409 — e.g. email already registered

export class AppError extends Error {
  readonly kind: AppErrorKind;
  /** Optional field-level details for validation errors. */
  readonly details?: Record<string, string>;

  constructor(kind: AppErrorKind, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.kind = kind;
    this.details = details;
  }
}

export const Unauthorized = (msg = "unauthorized") => new AppError("unauthorized", msg);
export const Forbidden = (msg = "forbidden") => new AppError("forbidden", msg);
export const NotFound = (msg = "not found") => new AppError("not_found", msg);
export const Conflict = (msg = "conflict") => new AppError("conflict", msg);
export const Validation = (msg: string, details?: Record<string, string>) =>
  new AppError("validation", msg, details);

/** Map an AppErrorKind to an HTTP status code. */
export function statusFor(kind: AppErrorKind): number {
  switch (kind) {
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "validation":
      return 400;
    case "conflict":
      return 409;
  }
}
