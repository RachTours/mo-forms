type CreatedTarget = {
  id: string;
  displayName: string;
  email: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type AssignedReviewerSummary = {
  membershipId: string;
  displayName: string;
  email: string;
} | null;

/** Project a persistence model onto the public target-create response contract. */
export function toCreatedTargetSummary(target: CreatedTarget, assignedReviewer: AssignedReviewerSummary) {
  return {
    id: target.id,
    displayName: target.displayName,
    email: target.email,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
    submissionCount: 0,
    assignedReviewer,
  };
}
