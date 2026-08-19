/**
 * API client response-handling tests — the logic worth trusting: status
 * mapping, error-body parsing, and network/parse-failure normalization.
 * Uses a mock fetch (no network). Run:
 *   node --experimental-strip-types --test lib/api/client.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiClient, handleResponse, type FetchLike } from "./client.ts";

function res(status: number, body: unknown, opts: { throwOnJson?: boolean } = {}) {
  return {
    status,
    json: async () => {
      if (opts.throwOnJson) throw new SyntaxError("Unexpected end of JSON input");
      return body;
    },
  };
}

test("handleResponse: 200 returns ok with typed data", async () => {
  const r = await handleResponse<{ id: string }>(res(200, { id: "u1" }));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.status, 200);
    assert.equal(r.data.id, "u1");
  }
});

test("handleResponse: 201 also treated as ok", async () => {
  const r = await handleResponse<{ card: unknown }>(res(201, { card: {} }));
  assert.equal(r.ok, true);
});

test("handleResponse: 403 maps to error with AppError kind preserved", async () => {
  const r = await handleResponse(res(403, { error: "forbidden", message: "nope" }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 403);
    assert.equal(r.error.error, "forbidden");
    assert.equal(r.error.message, "nope");
  }
});

test("handleResponse: 400 validation error preserves details", async () => {
  const r = await handleResponse(
    res(400, { error: "validation", message: "bad", details: { email: "invalid" } })
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.error, "validation");
    assert.equal(r.error.details?.email, "invalid");
  }
});

test("handleResponse: non-JSON error body is normalized, does not throw", async () => {
  const r = await handleResponse(res(500, null, { throwOnJson: true }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.error, "invalid_response");
});

test("handleResponse: 204-style ok with no JSON body => ok empty object", async () => {
  const r = await handleResponse(res(204, null, { throwOnJson: true }));
  assert.equal(r.ok, true);
});

test("handleResponse: error body without 'error' field => unknown_error", async () => {
  const r = await handleResponse(res(500, { oops: true }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.error, "unknown_error");
});

test("client: network failure (fetch throws) becomes error result status 0", async () => {
  const throwingFetch: FetchLike = async () => {
    throw new Error("connection refused");
  };
  const api = createApiClient(throwingFetch);
  const r = await api.getMyCards();
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 0);
    assert.equal(r.error.error, "network_error");
  }
});

test("client: login sends POST to /auth/login with JSON body", async () => {
  const calls: Array<{ input: string; init?: Parameters<FetchLike>[1] }> = [];
  const mockFetch: FetchLike = async (input, init) => {
    calls.push({ input, init });
    return res(200, { id: "u1", email: "a@b.com" });
  };
  const api = createApiClient(mockFetch, "/api");
  const r = await api.login("a@b.com", "pw12345678");
  assert.equal(r.ok, true);
  assert.equal(calls[0].input, "/api/auth/login");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
    email: "a@b.com",
    password: "pw12345678",
  });
});

test("client: getCatalog encodes the search query", async () => {
  let seen = "";
  const mockFetch: FetchLike = async (input) => {
    seen = input;
    return res(200, { cards: [] });
  };
  const api = createApiClient(mockFetch);
  await api.getCatalog("blue cash");
  assert.equal(seen, "/cards/catalog?search=blue%20cash");
});
