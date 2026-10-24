import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSchema, updateTargetSchema } from "../../../dist/modules/targets/target.schemas.js";
import { toCreatedTargetSummary } from "../../../dist/modules/targets/target-response.js";
import { targetCreateResponseSchema } from "@reviewroom/contracts";

test("new target API responses match the strict public response contract", () => {
  const created = {
    id: "8bd11f59-87b2-4ac2-8450-adf0e5e8094d",
    organizationId: "1a40fba6-6847-4f1f-bf9d-dfbff2088e9a",
    displayName: "Alex Morgan",
    email: null,
    status: "ACTIVE",
    createdAt: "2026-10-24T10:00:00.000Z",
    updatedAt: "2026-10-24T10:00:00.000Z",
    archivedAt: null,
  };
  const response = { data: toCreatedTargetSummary(created, null) };
  assert.equal(targetCreateResponseSchema.safeParse(response).success, true);
});

test("new review targets can be created without assignment data", () => {
  const reviewerId = "8bd11f59-87b2-4ac2-8450-adf0e5e8094d";
  assert.deepEqual(createTargetSchema.parse({ displayName: "Alex Morgan", email: "alex@example.com" }), { displayName: "Alex Morgan", email: "alex@example.com" });
  assert.deepEqual(createTargetSchema.parse({ displayName: "Alex Morgan", email: "" }), { displayName: "Alex Morgan", email: "" });
});

test("target input rejects malformed IDs and update requests cannot change assignment", () => {
  assert.throws(() => createTargetSchema.parse({ displayName: "Alex", reviewerId: "8bd11f59-87b2-4ac2-8450-adf0e5e8094d" }));
  assert.throws(() => updateTargetSchema.parse({ reviewerId: "8bd11f59-87b2-4ac2-8450-adf0e5e8094d" }));
  assert.throws(() => createTargetSchema.parse({ displayName: "Alex", unexpected: true }));
});
