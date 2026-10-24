import assert from "node:assert/strict";
import test from "node:test";
import { sessionSelectorFromUrl, withSessionSelector } from "./session-url.ts";

test("session selector is preserved alongside route query and hash", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const route = withSessionSelector("/admin/team?state=unassigned#assignments", id);
  assert.equal(route, `/admin/team?state=unassigned&rr_session=${id}#assignments`);
  assert.equal(sessionSelectorFromUrl(route), id);
});

test("session selector ignores malformed and external values", () => {
  assert.equal(sessionSelectorFromUrl("https://example.com/?rr_session=11111111-1111-4111-8111-111111111111"), undefined);
  assert.equal(sessionSelectorFromUrl("/admin?rr_session=not-a-uuid"), undefined);
  assert.throws(() => withSessionSelector("//attacker.invalid", "id"), /same-origin/);
});
