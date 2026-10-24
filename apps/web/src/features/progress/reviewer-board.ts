export type ReviewerProgress = { reviewerId: string; displayName: string; assigned: number; completed: number; remaining: number; percent: number };
export type ReviewerSort = "completion" | "name" | "completed" | "remaining";

export function getPeopleRemainingForGoal(targetGoal: number, activeTargets: number): number {
  return Math.max(0, targetGoal - activeTargets);
}

export function getReviewerGoalLabels(completedPeople: number, targetGoal: number, submissions: number) {
  const remaining = getPeopleRemainingForGoal(targetGoal, completedPeople);
  return {
    goal: `${completedPeople} of ${targetGoal} people reviewed · ${remaining} remaining`,
    submissions: `${submissions} submission${submissions === 1 ? "" : "s"}`,
    explanation: "Multiple submissions for one person count once toward the goal.",
  };
}

export function toReviewerProgress(rows: Array<{ reviewerId: string; displayName: string; assigned: number; completed: number }>, targetGoal?: number): ReviewerProgress[] {
  return rows.map((row) => ({ ...row, remaining: Math.max(0, row.assigned - row.completed), percent: targetGoal !== undefined ? targetGoal > 0 ? Math.min(100, Math.round((row.completed / targetGoal) * 100)) : 0 : row.assigned > 0 ? Math.round((row.completed / row.assigned) * 100) : 0 }));
}

export function getTeamReviewerProgress(rows: Array<{ reviewerId: string; displayName: string; assigned: number; completed: number }>) {
  const eligible = rows.filter((row) => row.assigned > 0);
  const completedReviewers = eligible.filter((row) => row.completed >= row.assigned).length;
  return { totalReviewers: eligible.length, completedReviewers, percent: eligible.length ? Math.round((completedReviewers / eligible.length) * 100) : 0 };
}

export function sortReviewerProgress(rows: ReviewerProgress[], sort: ReviewerSort): ReviewerProgress[] {
  return [...rows].sort((a, b) => {
    if (sort === "name") return a.displayName.localeCompare(b.displayName) || a.reviewerId.localeCompare(b.reviewerId);
    if (sort === "completed") return b.completed - a.completed || b.percent - a.percent || a.displayName.localeCompare(b.displayName);
    if (sort === "remaining") return a.remaining - b.remaining || a.displayName.localeCompare(b.displayName) || a.reviewerId.localeCompare(b.reviewerId);
    return b.percent - a.percent || b.completed - a.completed || a.displayName.localeCompare(b.displayName);
  });
}
