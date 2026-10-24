import assert from "node:assert/strict";
import test from "node:test";
import { getDirectOpenLinkProps } from "./my-review-link-model.ts";

test("direct form-link actions open the same link in a protected new tab", () => {
  assert.deepEqual(getDirectOpenLinkProps("https://example.test/r/token"), {
    href: "https://example.test/r/token",
    target: "_blank",
    rel: "noopener noreferrer",
  });
});
