import assert from "node:assert/strict";
import test from "node:test";
import { getPeopleRemainingForGoal, sortReviewerProgress, toReviewerProgress } from "./reviewer-board.ts";

test("people still to add counts the difference between the goal and active targets", () => {
  assert.equal(getPeopleRemainingForGoal(50, 2), 48);
});

test("people still to add never becomes negative after the goal is reached", () => {
  assert.equal(getPeopleRemainingForGoal(50, 52), 0);
});

const source = [
  { reviewerId: "a", displayName: "Ada", assigned: 0, completed: 0 },
  { reviewerId: "b", displayName: "Ben", assigned: 4, completed: 4 },
  { reviewerId: "c", displayName: "Cy", assigned: 4, completed: 2 },
];

test("review progress keeps zero assignments at zero and computes remaining work", () => {
  assert.deepEqual(toReviewerProgress(source), [
    { ...source[0], remaining: 0, percent: 0 },
    { ...source[1], remaining: 0, percent: 100 },
    { ...source[2], remaining: 2, percent: 50 },
  ]);
});

test("review board has deterministic default and user-selected sorts without ordinal rank", () => {
  const rows = toReviewerProgress(source);
  assert.deepEqual(sortReviewerProgress(rows, "completion").map((row) => row.reviewerId), ["b", "c", "a"]);
  assert.deepEqual(sortReviewerProgress(rows, "name").map((row) => row.reviewerId), ["a", "b", "c"]);
  assert.deepEqual(sortReviewerProgress(rows, "completed").map((row) => row.reviewerId), ["b", "c", "a"]);
  assert.deepEqual(sortReviewerProgress(rows, "remaining").map((row) => row.reviewerId), ["a", "b", "c"]);
});

test("reviewer board percentages use the shared target goal when it is provided", () => {
  const rows = toReviewerProgress([{ reviewerId: "r1", displayName: "Reviewer", assigned: 1, completed: 1 }], 50);
  assert.equal(rows[0].percent, 2);
  assert.equal(rows[0].remaining, 0);
  assert.equal(toReviewerProgress([{ reviewerId: "r1", displayName: "Reviewer", assigned: 1, completed: 1 }], 0)[0].percent, 0);
});

test("team progress excludes reviewers without assigned work from completion denominator", async () => {
  const { getTeamReviewerProgress } = await import("./reviewer-board.ts");
  assert.deepEqual(getTeamReviewerProgress([
    { reviewerId: "a", displayName: "A", assigned: 1, completed: 1 },
    { reviewerId: "b", displayName: "B", assigned: 1, completed: 0 },
    { reviewerId: "c", displayName: "C", assigned: 0, completed: 0 },
  ]), { totalReviewers: 2, completedReviewers: 1, percent: 50 });
});

test("team progress is zero when no active reviewer has assignments", async () => {
  const { getTeamReviewerProgress } = await import("./reviewer-board.ts");
  assert.deepEqual(getTeamReviewerProgress([{ reviewerId: "a", displayName: "A", assigned: 0, completed: 0 }]), { totalReviewers: 0, completedReviewers: 0, percent: 0 });
});
