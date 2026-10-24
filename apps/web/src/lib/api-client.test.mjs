import assert from "node:assert/strict";
import test from "node:test";
import { requestApi, ApiClientError } from "./api-client.ts";

function response(status, body, headers = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

test("sends role, CSRF, same-origin credentials, and no-store cache policy", async () => {
  let seen;
  const result = await requestApi("/members", { method: "GET" }, {
    role: "OWNER", csrfToken: "c".repeat(64), sessionId: "11111111-1111-4111-8111-111111111111",
    fetcher: async (url, init) => { seen = { url, init }; return response(200, { data: [] }); },
  });
  assert.deepEqual(result, { data: [] });
  assert.equal(seen.url, "/api/v1/members");
  assert.equal(seen.init.credentials, "same-origin");
  assert.equal(seen.init.cache, "no-store");
  assert.equal(seen.init.headers.get("X-Reviewroom-Audience"), "admin");
  assert.equal(seen.init.headers.get("X-Reviewroom-Session-Id"), "11111111-1111-4111-8111-111111111111");
});

test("writes include the role-specific CSRF token and JSON content type", async () => {
  let headers;
  await requestApi("/assignments/t1", { method: "PUT", body: "{}" }, {
    role: "REVIEWER", csrfToken: "d".repeat(64), sessionId: "22222222-2222-4222-8222-222222222222",
    fetcher: async (_url, init) => { headers = init.headers; return response(200, { data: {} }); },
  });
  assert.equal(headers.get("X-Reviewroom-Audience"), "reviewer");
  assert.equal(headers.get("X-Reviewroom-Session-Id"), "22222222-2222-4222-8222-222222222222");
  assert.equal(headers.get("X-CSRF-Token"), "d".repeat(64));
  assert.equal(headers.get("Content-Type"), "application/json");
});

test("legacy role-cookie sessions do not send a per-tab selector before reauthentication", async () => {
  let headers;
  await requestApi("/members", {}, {
    role: "OWNER", csrfToken: "c".repeat(64), sessionId: null,
    fetcher: async (_url, init) => { headers = init.headers; return response(200, { data: [] }); },
  });
  assert.equal(headers.has("X-Reviewroom-Session-Id"), false);
});

test("returns undefined for 204 and does not attempt to parse a body", async () => {
  const result = await requestApi("/members/m1", { method: "DELETE" }, {
    role: "OWNER", csrfToken: "c".repeat(64), sessionId: "11111111-1111-4111-8111-111111111111", fetcher: async () => response(204),
  });
  assert.equal(result, undefined);
});

test("preserves stable error status, code and request reference for client/server failures", async () => {
  for (const status of [401, 403, 409, 422, 429, 500]) {
    await assert.rejects(requestApi("/members", {}, {
      role: "OWNER", csrfToken: "c".repeat(64), sessionId: "11111111-1111-4111-8111-111111111111", fetcher: async () => response(status, { error: { code: "REQUEST_FAILED", message: "Try again.", requestId: "req-1" } }),
    }), (error) => error instanceof ApiClientError && error.status === status && error.code === "REQUEST_FAILED" && error.requestId === "req-1");
  }
});

test("uses a safe fallback when an error body is malformed or non-JSON", async () => {
  await assert.rejects(requestApi("/members", {}, {
    role: "OWNER", csrfToken: "c".repeat(64), sessionId: "11111111-1111-4111-8111-111111111111", fetcher: async () => new Response("not-json", { status: 502 }),
  }), (error) => error instanceof ApiClientError && error.status === 502 && error.message === "The service could not complete the request.");
});

test("rejects malformed successful payloads when a response schema is supplied", async () => {
  const schema = { safeParse: (value) => value?.data ? { success: true, data: value } : { success: false } };
  assert.deepEqual(await requestApi("/members", {}, { role: "OWNER", csrfToken: "c".repeat(64), sessionId: "11111111-1111-4111-8111-111111111111", schema, fetcher: async () => response(200, { data: [] }) }), { data: [] });
  await assert.rejects(requestApi("/members", {}, { role: "OWNER", csrfToken: "c".repeat(64), sessionId: "11111111-1111-4111-8111-111111111111", schema, fetcher: async () => response(200, { unexpected: true }) }), /unexpected response/);
});

test("rejects non-local API paths and propagates aborts", async () => {
  await assert.rejects(requestApi("https://attacker.example/path", {}, { role: "OWNER", csrfToken: "c".repeat(64), sessionId: "11111111-1111-4111-8111-111111111111", fetcher: async () => response(200, {}) }), /relative API path/);
  const abort = new DOMException("Aborted", "AbortError");
  await assert.rejects(requestApi("/members", {}, { role: "OWNER", csrfToken: "c".repeat(64), sessionId: "11111111-1111-4111-8111-111111111111", fetcher: async () => { throw abort; } }), (error) => error === abort);
});
