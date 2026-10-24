export function getSubmissionCompletionPercent(submissionCount: number, targetCount: number): number {
  if (targetCount <= 0) return 0;
  return Math.min(100, Math.round((submissionCount / targetCount) * 1000) / 10);
}
