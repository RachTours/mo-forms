import assert from "node:assert/strict";
import test from "node:test";
import { requestSignOut } from "./sign-out.ts";

test("sign-out targets only the active reviewer session in this tab", async () => {
  const sessionId = "11111111-1111-4111-8111-111111111111";
  let captured;
  const response = new Response(null, { status: 204 });
  const result = await requestSignOut({ role: "REVIEWER", csrfToken: "csrf", sessionId }, async (...args) => {
    captured = args;
    return response;
  });

  assert.equal(result, response);
  assert.equal(captured[0], "/api/v1/auth/logout");
  assert.equal(captured[1].method, "POST");
  assert.equal(captured[1].credentials, "same-origin");
  assert.equal(captured[1].headers.get("X-Reviewroom-Audience"), "reviewer");
  assert.equal(captured[1].headers.get("X-Reviewroom-Session-Id"), sessionId);
  assert.equal(captured[1].headers.get("X-CSRF-Token"), "csrf");
});

test("legacy sessions sign out without a tab selector header", async () => {
  let captured;
  await requestSignOut({ role: "OWNER", csrfToken: "csrf", sessionId: null }, async (...args) => {
    captured = args;
    return new Response(null, { status: 204 });
  });
  assert.equal(captured[1].headers.get("X-Reviewroom-Audience"), "admin");
  assert.equal(captured[1].headers.has("X-Reviewroom-Session-Id"), false);
});
