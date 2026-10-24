import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { Prisma } from "../../generated/prisma/client.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { getSubmissionCompletionPercent } from "./progress-metrics.js";

export const progressRouter = Router();
progressRouter.use(requireSession);

progressRouter.get("/reviewer-board", async (request, response, next) => {
  try {
    const auth = request.auth!;
    const reviewerOnly = auth.role === "REVIEWER";
    const rows = await prisma.$queryRaw<Array<{ reviewerId: string; displayName: string; assigned: bigint; completed: bigint }>>`
      SELECT m.id AS reviewerId, u.displayName AS displayName,
        COUNT(DISTINCT t.id) AS assigned,
        COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN t.id END) AS completed
      FROM Membership m
      INNER JOIN User u ON u.id = m.userId AND u.status = 'ACTIVE'
      LEFT JOIN Assignment a ON a.reviewerId = m.id AND a.organizationId = m.organizationId
      LEFT JOIN ReviewTarget t ON t.id = a.targetId AND t.organizationId = m.organizationId AND t.status = 'ACTIVE' AND t.archivedAt IS NULL
      LEFT JOIN Submission s ON s.targetId = t.id AND s.reviewerId = m.id AND s.organizationId = m.organizationId AND s.archivedAt IS NULL
      WHERE m.organizationId = ${auth.organizationId} AND m.role = 'REVIEWER' AND m.status = 'ACTIVE'
        AND (${!reviewerOnly} OR m.id = ${auth.membershipId})
      GROUP BY m.id, u.displayName
    `;
    response.json({ data: rows.map((row) => ({ reviewerId: row.reviewerId, displayName: row.displayName, assigned: Number(row.assigned), completed: Number(row.completed) })) });
  } catch (error) { next(error); }
});

progressRouter.get("/summary", async (request, response, next) => {
  try {
    const auth = request.auth!;
    const reviewerScope = auth.role === "REVIEWER" ? { reviewerId: auth.membershipId } : undefined;
    const organizationId = auth.organizationId;
    const reviewerCompletionScope = reviewerScope ? Prisma.sql`AND a.reviewerId = ${auth.membershipId}` : Prisma.empty;
    const [activeTargets, assignedTargets, completedRows, responseCount, unassignedTargets, config, organizationTargetCount] = await Promise.all([
      prisma.reviewTarget.count({ where: { organizationId, status: "ACTIVE", archivedAt: null, ...(reviewerScope ? { assignments: { some: reviewerScope } } : {}) } }),
      prisma.assignment.count({ where: { organizationId, ...(reviewerScope ?? {}), reviewer: { role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } }, target: { status: "ACTIVE", archivedAt: null } } }),
      prisma.$queryRaw<Array<{ completed: bigint }>>`
        SELECT COUNT(DISTINCT a.targetId) AS completed
        FROM Assignment a
        INNER JOIN ReviewTarget t ON t.id = a.targetId AND t.organizationId = a.organizationId AND t.status = 'ACTIVE' AND t.archivedAt IS NULL
        INNER JOIN Membership m ON m.id = a.reviewerId AND m.organizationId = a.organizationId AND m.role = 'REVIEWER' AND m.status = 'ACTIVE'
        INNER JOIN User u ON u.id = m.userId AND u.status = 'ACTIVE'
        INNER JOIN Submission s ON s.targetId = t.id AND s.reviewerId = a.reviewerId AND s.organizationId = a.organizationId AND s.archivedAt IS NULL
        WHERE a.organizationId = ${organizationId} ${reviewerCompletionScope}
      `,
      prisma.submission.count({ where: { organizationId, archivedAt: null, target: { status: "ACTIVE", archivedAt: null }, ...(reviewerScope ?? {}) } }),
      auth.role === "REVIEWER" ? Promise.resolve(0) : prisma.reviewTarget.count({ where: { organizationId, status: "ACTIVE", archivedAt: null, assignments: { none: { organizationId, reviewer: { role: "REVIEWER", status: "ACTIVE", user: { status: "ACTIVE" } } } } } }),
      prisma.progressConfig.findUnique({ where: { organizationId }, select: { completionRule: true, targetCount: true, updatedAt: true } }),
      prisma.reviewTarget.count({ where: { organizationId, status: "ACTIVE", archivedAt: null } }),
    ]);
    const completedTargets = Number(completedRows[0]?.completed ?? 0n);
    const targetCount = config?.targetCount ?? organizationTargetCount;
    const completionPercent = getSubmissionCompletionPercent(responseCount, targetCount);
    response.json({ data: { activeTargets, assignedTargets, completedTargets, responseCount, unassignedTargets, targetCount, completionRule: config?.completionRule ?? "ONE_RESPONSE", completionPercent } });
  } catch (error) { next(error); }
});

const progressConfigSchema = z.object({
  targetCount: z.number().int().min(0).max(100_000),
  completionRule: z.literal("ONE_RESPONSE"),
}).strict();

progressRouter.patch("/config", requirePermission("settings", "manage"), requireCsrf, async (request, response, next) => {
  try {
    const input = progressConfigSchema.parse(request.body);
    const auth = request.auth!;
    const config = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.progressConfig.upsert({
        where: { organizationId: auth.organizationId },
        create: { organizationId: auth.organizationId, targetCount: input.targetCount, completionRule: input.completionRule },
        update: { targetCount: input.targetCount, completionRule: input.completionRule },
      });
      await transaction.auditEvent.create({ data: { organizationId: auth.organizationId, actorId: auth.userId, action: "PROGRESS_CONFIG_UPDATED", entityType: "ProgressConfig", entityId: saved.id, metadata: input } });
      return saved;
    });
    response.json({ data: { targetCount: config.targetCount, completionRule: config.completionRule } });
  } catch (error) { next(error); }
});

