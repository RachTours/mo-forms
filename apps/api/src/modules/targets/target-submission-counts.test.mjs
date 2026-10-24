import assert from "node:assert/strict";
import test from "node:test";
import { activeTargetListFilter, loadTargetAssignments, loadTargetSubmissionCounts } from "../../../dist/modules/targets/target-submission-counts.js";

test("does not add a LIKE filter when the people list has no search term", () => {
  assert.deepEqual(activeTargetListFilter("workspace-1", ""), {
    organizationId: "workspace-1",
    status: "ACTIVE",
    archivedAt: null,
  });
});

test("applies the name search only when it has a value", () => {
  assert.deepEqual(activeTargetListFilter("workspace-1", "Fatima"), {
    organizationId: "workspace-1",
    status: "ACTIVE",
    archivedAt: null,
    displayName: { contains: "Fatima" },
  });
});

test("loads bounded active submission counts with an explicit workspace filter", async () => {
  let query;
  const transaction = {
    submission: {
      groupBy: async (input) => {
        query = input;
        return [
          { targetId: "target-1", _count: { _all: 2 } },
          { targetId: "target-2", _count: { _all: 1 } },
        ];
      },
    },
  };
  const counts = await loadTargetSubmissionCounts(transaction, "workspace-1", ["target-1", "target-2"]);
  assert.deepEqual([...counts], [["target-1", 2], ["target-2", 1]]);
  assert.deepEqual(query, {
    by: ["targetId"],
    where: { organizationId: "workspace-1", archivedAt: null, targetId: { in: ["target-1", "target-2"] } },
    _count: { _all: true },
  });
});

test("does not query counts for an empty target page", async () => {
  let called = false;
  const transaction = { submission: { groupBy: async () => { called = true; return []; } } };
  assert.equal((await loadTargetSubmissionCounts(transaction, "workspace-1", [])).size, 0);
  assert.equal(called, false);
});

test("loads reviewer context through flat tenant-scoped queries", async () => {
  const queries = {};
  const reader = {
    assignment: { findMany: async (input) => {
      queries.assignments = input;
      return [
        { targetId: "target-1", reviewerId: "reviewer-1", updatedAt: new Date("2026-10-24T10:00:00Z") },
        { targetId: "target-2", reviewerId: "reviewer-inactive", updatedAt: new Date("2026-10-24T10:00:00Z") },
      ];
    } },
    membership: { findMany: async (input) => {
      queries.memberships = input;
      return [{ id: "reviewer-1", userId: "user-1" }];
    } },
    user: { findMany: async (input) => {
      queries.users = input;
      return [{ id: "user-1", displayName: "Reviewer One", email: "reviewer@example.com" }];
    } },
  };
  const assignments = await loadTargetAssignments(reader, "workspace-1", ["target-1", "target-2"]);
  assert.deepEqual([...assignments], [["target-1", { membershipId: "reviewer-1", displayName: "Reviewer One", email: "reviewer@example.com" }]]);
  assert.deepEqual(queries, {
    assignments: {
      where: { organizationId: "workspace-1", targetId: { in: ["target-1", "target-2"] } },
      orderBy: [{ targetId: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
      select: { targetId: true, reviewerId: true },
    },
    memberships: {
      where: { id: { in: ["reviewer-1", "reviewer-inactive"] }, organizationId: "workspace-1", role: "REVIEWER", status: "ACTIVE" },
      select: { id: true, userId: true },
    },
    users: {
      where: { id: { in: ["user-1"] }, status: "ACTIVE" },
      select: { id: true, displayName: true, email: true },
    },
  });
});

test("does not query reviewer context for an empty target page", async () => {
  let called = false;
  const reader = { assignment: { findMany: async () => { called = true; return []; } } };
  assert.equal((await loadTargetAssignments(reader, "workspace-1", [])).size, 0);
  assert.equal(called, false);
});
