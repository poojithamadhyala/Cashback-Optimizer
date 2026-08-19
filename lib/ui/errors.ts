/**
 * Map an ApiErrorBody into a user-facing message. Pure; tested implicitly via
 * pages. Kept small and dependency-free.
 */
import type { ApiErrorBody } from "../api/types.ts";

export function errorMessage(err: ApiErrorBody): string {
  switch (err.error) {
    case "validation":
      // Prefer field details when present.
      if (err.details) {
        const first = Object.entries(err.details)[0];
        if (first) return `${first[0]}: ${first[1]}`;
      }
      return err.message ?? "Please check your input.";
    case "unauthorized":
      return "Invalid email or password.";
    case "forbidden":
      return "You don't have access to that.";
    case "not_found":
      return "Not found.";
    case "conflict":
      return err.message ?? "That already exists.";
    case "network_error":
      return "Network error — please try again.";
    default:
      return err.message ?? "Something went wrong.";
  }
}
