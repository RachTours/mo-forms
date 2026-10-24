import test from "node:test";
import assert from "node:assert/strict";
import { getSubmissionCompletionPercent } from "../../../dist/modules/progress/progress-metrics.js";

test("submission progress is measured against the workspace goal", () => {
  assert.equal(getSubmissionCompletionPercent(2, 50), 4);
  assert.equal(getSubmissionCompletionPercent(3, 50), 6);
});

test("submission progress keeps one decimal place when the percentage is fractional", () => {
  assert.equal(getSubmissionCompletionPercent(1, 40), 2.5);
  assert.equal(getSubmissionCompletionPercent(13, 500), 2.6);
});

test("progress is zero when the workspace goal is zero", () => {
  assert.equal(getSubmissionCompletionPercent(0, 0), 0);
});

test("progress is capped at the workspace goal", () => {
  assert.equal(getSubmissionCompletionPercent(60, 50), 100);
});
