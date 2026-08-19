/**
 * Browser-side API client singleton. Binds the tested createApiClient to the
 * real `fetch` and the app's API base path (Next route handlers live under /api).
 *
 * `credentials: "include"` ensures the httpOnly session cookie is sent.
 */
"use client";

import { createApiClient, type FetchLike } from "./client.ts";

const browserFetch: FetchLike = async (input, init) => {
  const res = await fetch(input, {
    method: init?.method,
    headers: init?.headers,
    body: init?.body,
    credentials: "include",
  });
  return { status: res.status, json: () => res.json() };
};

export const api = createApiClient(browserFetch, "/api");
