import type { Prisma } from "../../generated/prisma/client.js";

type SubmissionCountReader = Pick<Prisma.TransactionClient, "submission">;
type TargetAssignmentReader = Pick<Prisma.TransactionClient, "assignment" | "membership" | "user">;

export type TargetAssignmentSummary = { membershipId: string; displayName: string; email: string };

export function activeTargetListFilter(organizationId: string, search: string) {
  return {
    organizationId,
    status: "ACTIVE" as const,
    archivedAt: null,
    ...(search ? { displayName: { contains: search } } : {}),
  };
}

/** Count this page's active submissions with one explicit, tenant-scoped GROUP BY query. */
export async function loadTargetSubmissionCounts(
  reader: SubmissionCountReader,
  organizationId: string,
  targetIds: string[],
): Promise<Map<string, number>> {
  if (targetIds.length === 0) return new Map();
  const groups = await reader.submission.groupBy({
    by: ["targetId"],
    where: { organizationId, archivedAt: null, targetId: { in: targetIds } },
    _count: { _all: true },
  });
  return new Map(groups.map(({ targetId, _count }) => [targetId, _count._all]));
}

/** Load the current eligible reviewer for only this bounded target page. */
export async function loadTargetAssignments(
  reader: TargetAssignmentReader,
  organizationId: string,
  targetIds: string[],
): Promise<Map<string, TargetAssignmentSummary>> {
  if (targetIds.length === 0) return new Map();
  // Keep these reads flat. Nested relation filters make MariaDB compare string
  // columns across legacy tables; Hostinger databases can contain tables with
  // different collations, which fails with MySQL 1267 before Prisma can return
  // any people. IDs are bounded to this page and every lookup remains tenant-scoped.
  const assignments = await reader.assignment.findMany({
    where: { organizationId, targetId: { in: targetIds } },
    orderBy: [{ targetId: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
    select: { targetId: true, reviewerId: true },
  });
  if (assignments.length === 0) return new Map();

  const membershipIds = [...new Set(assignments.map(({ reviewerId }) => reviewerId))];
  const memberships = await reader.membership.findMany({
    where: { id: { in: membershipIds }, organizationId, role: "REVIEWER", status: "ACTIVE" },
    select: { id: true, userId: true },
  });
  if (memberships.length === 0) return new Map();

  const userIds = [...new Set(memberships.map(({ userId }) => userId))];
  const users = await reader.user.findMany({
    where: { id: { in: userIds }, status: "ACTIVE" },
    select: { id: true, displayName: true, email: true },
  });
  const membershipsById = new Map(memberships.map((membership) => [membership.id, membership]));
  const usersById = new Map(users.map((user) => [user.id, user]));
  const result = new Map<string, TargetAssignmentSummary>();
  for (const assignment of assignments) {
    const membership = membershipsById.get(assignment.reviewerId);
    const user = membership ? usersById.get(membership.userId) : undefined;
    if (membership && user && !result.has(assignment.targetId)) {
      result.set(assignment.targetId, { membershipId: membership.id, displayName: user.displayName, email: user.email });
    }
  }
  return result;
}
