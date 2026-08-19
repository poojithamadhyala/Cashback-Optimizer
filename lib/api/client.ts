/**
 * Typed API client. The response-handling core (`handleResponse`) is pure and
 * takes an injectable `fetch`, so it is unit-testable offline with a mock —
 * that's where the logic worth trusting lives (status mapping, error-body
 * parsing, network/parse failure handling).
 *
 * Every call returns a discriminated `ApiResult<T>` instead of throwing, so UI
 * components can render error states without try/catch sprawl.
 */

import type {
  ApiErrorBody,
  AuthUserDTO,
  CatalogResponse,
  UserCardsResponse,
  AddUserCardResponse,
  ReceiptResponse,
  ReceiptsResponse,
  ConfirmReceiptResponse,
  DashboardSummaryResponse,
  CheatsheetResponse,
  ReceiptStatus,
} from "./types.ts";

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiErrorBody };

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | FormData;
  }
) => Promise<{
  status: number;
  json: () => Promise<unknown>;
}>;

/**
 * Turn a raw response into a typed ApiResult. Pure given the response object.
 * - 2xx: parse JSON as T
 * - non-2xx: parse the error body (falling back to a generic shape)
 * - JSON parse failure: normalized into an error result, never throws
 */
export async function handleResponse<T>(res: {
  status: number;
  json: () => Promise<unknown>;
}): Promise<ApiResult<T>> {
  const ok = res.status >= 200 && res.status < 300;
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // Body wasn't JSON (or empty). Represent consistently.
    if (ok) {
      // A 204-style success with no body; treat as empty object.
      return { ok: true, status: res.status, data: {} as T };
    }
    return {
      ok: false,
      status: res.status,
      error: { error: "invalid_response", message: "response was not valid JSON" },
    };
  }

  if (ok) {
    return { ok: true, status: res.status, data: body as T };
  }
  const err = normalizeError(body);
  return { ok: false, status: res.status, error: err };
}

function normalizeError(body: unknown): ApiErrorBody {
  if (body && typeof body === "object" && "error" in body) {
    const b = body as Record<string, unknown>;
    return {
      error: typeof b.error === "string" ? b.error : "unknown_error",
      message: typeof b.message === "string" ? b.message : undefined,
      details:
        b.details && typeof b.details === "object"
          ? (b.details as Record<string, string>)
          : undefined,
    };
  }
  return { error: "unknown_error" };
}

/** Wrap a fetch call so network failures become an error result, not a throw. */
async function request<T>(
  doFetch: FetchLike,
  input: string,
  init?: Parameters<FetchLike>[1]
): Promise<ApiResult<T>> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await doFetch(input, init);
  } catch {
    return {
      ok: false,
      status: 0,
      error: { error: "network_error", message: "request failed" },
    };
  }
  return handleResponse<T>(res);
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Build a client bound to a base URL + fetch implementation. In the browser,
 * pass the real `fetch`. In tests, pass a mock.
 */
export function createApiClient(doFetch: FetchLike, baseUrl = "") {
  const url = (path: string) => `${baseUrl}${path}`;
  return {
    // Auth
    signup: (email: string, password: string) =>
      request<AuthUserDTO>(doFetch, url("/auth/signup"), {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<AuthUserDTO>(doFetch, url("/auth/login"), {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, password }),
      }),
    logout: () =>
      request<{ ok: boolean }>(doFetch, url("/auth/logout"), { method: "POST" }),

    // Cards
    getCatalog: (search?: string) =>
      request<CatalogResponse>(
        doFetch,
        url(`/cards/catalog${search ? `?search=${encodeURIComponent(search)}` : ""}`)
      ),
    getMyCards: () => request<UserCardsResponse>(doFetch, url("/users/me/cards")),
    addCard: (cardCatalogId: string, nickname?: string) =>
      request<AddUserCardResponse>(doFetch, url("/users/me/cards"), {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ cardCatalogId, nickname }),
      }),
    removeCard: (id: string) =>
      request<{ ok: boolean }>(doFetch, url(`/users/me/cards/${id}`), {
        method: "DELETE",
      }),

    // Receipts
    uploadReceipt: (form: FormData) =>
      request<ReceiptResponse>(doFetch, url("/receipts"), { method: "POST", body: form }),
    listReceipts: (status?: ReceiptStatus) =>
      request<ReceiptsResponse>(
        doFetch,
        url(`/receipts${status ? `?status=${status}` : ""}`)
      ),
    getReceipt: (id: string) => request<ReceiptResponse>(doFetch, url(`/receipts/${id}`)),
    confirmReceipt: (id: string, edits: Record<string, unknown>) =>
      request<ConfirmReceiptResponse>(doFetch, url(`/receipts/${id}`), {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(edits),
      }),
    deleteReceipt: (id: string) =>
      request<{ ok: boolean }>(doFetch, url(`/receipts/${id}`), { method: "DELETE" }),

    // Dashboard
    getSummary: () =>
      request<DashboardSummaryResponse>(doFetch, url("/dashboard/summary")),
    getCheatsheet: () =>
      request<CheatsheetResponse>(doFetch, url("/dashboard/best-card-cheatsheet")),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
