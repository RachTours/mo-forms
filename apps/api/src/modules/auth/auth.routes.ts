import { Router } from "express";
import { z } from "zod";
import { env } from "../../env.js";
import { prisma } from "../../db/client.js";
import { HttpError } from "../../http/errors.js";
import { authRateLimit } from "../../http/rate-limits.js";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { hashPassword, verifyPassword } from "./password.js";
import { chooseWorkspaceMembership } from "./workspace-selection.js";
import { clearSessionCookie, hashToken, legacySessionCookieName, newSessionToken, setSessionCookie, sessionLifetimeMs, createCsrfToken } from "./session.js";
import { authenticateMemberships, type LoginAudience } from "./auth-policy.js";
import { assertPasswordResetTokenUsable, hashPasswordResetToken } from "./password-reset.js";
import { passwordResetRequestSchema } from "@reviewroom/contracts";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
  organizationSlug: z.string().trim().min(1).max(80).toLowerCase().optional(),
}).strict();

function login(audience?: LoginAudience) {
  return async (request: import("express").Request, response: import("express").Response, next: import("express").NextFunction) => {
  try {
    if (request.get("origin") !== env.WEB_ORIGIN) throw new HttpError(403, "ORIGIN_REJECTED", "The request could not be verified.");
    const input = loginSchema.parse(request.body);
    const email = input.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { where: { status: "ACTIVE" }, include: { organization: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!user || user.status !== "ACTIVE" || !user.memberships.length) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Email, password, or workspace is incorrect.");
    }
    const authenticatedMemberships = await authenticateMemberships(user.memberships, input.password, verifyPassword, audience);
    if (!authenticatedMemberships.length) throw new HttpError(401, "INVALID_CREDENTIALS", "Email, password, or workspace is incorrect.");
    const choice = chooseWorkspaceMembership(authenticatedMemberships, input.organizationSlug);
    if (choice.kind === "missing") throw new HttpError(401, "INVALID_CREDENTIALS", "Email, password, or workspace is incorrect.");
    if (choice.kind === "choose") {
      response.status(409).json({ error: { code: "WORKSPACE_SELECTION_REQUIRED", message: "Choose the workspace you want to open.", requestId: response.locals.requestId as string | undefined }, data: { workspaces: choice.memberships.map(({ organization, role }) => ({ ...organization, role })) } });
      return;
    }
    const membership = choice.membership;
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + sessionLifetimeMs);
    const session = await prisma.session.create({ data: {
      tokenHash: hashToken(token), userId: user.id, organizationId: membership.organizationId,
      membershipId: membership.id, expiresAt,
    } });
    setSessionCookie(response, token, membership.role === "REVIEWER" ? "reviewer" : "admin", session.id);
    response.status(200).json({
      sessionId: session.id,
      user: { id: user.id, email: user.email, displayName: user.displayName },
      organization: { id: membership.organization.id, name: membership.organization.name, slug: membership.organization.slug },
      role: membership.role,
      csrfToken: createCsrfToken(session.id),
    });
  } catch (error) { next(error); }
  };
}

authRouter.post("/login", authRateLimit, login());
authRouter.post("/admin/login", authRateLimit, login("admin"));
authRouter.post("/reviewer/login", authRateLimit, login("reviewer"));

authRouter.post("/password-reset", authRateLimit, async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    if (request.get("origin") !== env.WEB_ORIGIN) throw new HttpError(403, "ORIGIN_REJECTED", "The request could not be verified.");
    const input = passwordResetRequestSchema.parse(request.body);
    const tokenHash = hashPasswordResetToken(input.token);
    const now = new Date();
    const reset = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true, membership: { select: { userId: true, organizationId: true, status: true } } },
    });
    if (!reset || reset.user.email !== input.email.trim().toLowerCase() || reset.user.status !== "ACTIVE" || reset.membership.status !== "ACTIVE" || reset.membership.userId !== reset.userId || reset.membership.organizationId !== reset.organizationId) {
      throw new HttpError(400, "PASSWORD_RESET_INVALID", "The reset token is invalid or expired.");
    }
    assertPasswordResetTokenUsable(reset, { userId: reset.membership.userId, membershipId: reset.membershipId, organizationId: reset.membership.organizationId }, now);
    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.passwordResetToken.updateMany({
        where: { id: reset.id, tokenHash, consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) throw new HttpError(400, "PASSWORD_RESET_INVALID", "The reset token is invalid or expired.");
      await transaction.membership.update({ where: { id: reset.membershipId }, data: { passwordHash } });
      await transaction.session.deleteMany({ where: { membershipId: reset.membershipId } });
      await transaction.passwordResetToken.updateMany({
        where: { membershipId: reset.membershipId, id: { not: reset.id }, consumedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.auditEvent.create({ data: {
        organizationId: reset.organizationId, actorId: reset.userId,
        action: "PASSWORD_RESET_COMPLETED", entityType: "Membership", entityId: reset.membershipId,
        metadata: { resetTokenId: reset.id },
      } });
    });
    response.status(204).end();
  } catch (error) { next(error); }
});

authRouter.get("/session", requireSession, (request, response) => {
  const auth = request.auth;
  if (!auth) return response.status(401).end();
    return response.status(200).json({ user: { id: auth.userId, email: auth.email, displayName: auth.displayName }, organizationId: auth.organizationId, organizationName: auth.organizationName, membershipId: auth.membershipId, sessionId: request.authSessionSelector ?? null, role: auth.role, csrfToken: request.csrfToken });
});

authRouter.post("/logout", requireSession, requireCsrf, async (request, response, next) => {
  try {
    await prisma.session.delete({ where: { id: request.auth!.sessionId } });
    clearSessionCookie(response, request.authCookieName ?? legacySessionCookieName);
    response.status(204).end();
  } catch (error) { next(error); }
});

