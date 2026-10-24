import assert from "node:assert/strict";
import test from "node:test";
import {
  apiErrorSchema,
  auditEventSummarySchema,
  assignmentListResponseSchema,
  assignmentMutationResponseSchema,
  assignmentRemoveResponseSchema,
  assignmentSetRequestSchema,
  invitationAcceptRequestSchema,
  invitationAcceptInfoSchema,
  invitationAcceptResponseSchema,
  invitationListResponseSchema,
  invitationRevealResponseSchema,
  invitationCreateRequestSchema,
  invitationCreatedSchema,
  loginResponseSchema,
  listQuerySchema,
  loginRequestSchema,
  formAnswersSchema,
  formDefinitionSchema,
  passwordResetRequestSchema,
  sessionResponseSchema,
  workspaceChoiceResponseSchema,
  memberUpdateRequestSchema,
  memberUpdateResponseSchema,
  passwordResetTokenCreatedSchema,
  passwordResetTokensResponseSchema,
  memberSummarySchema,
  memberListResponseSchema,
  organizationThemeResponseSchema,
  progressConfigSchema,
  progressSummarySchema,
  publicReviewReadResponseSchema,
  reviewLinkSummarySchema,
  submissionReceiptSchema,
  submissionCreateRequestSchema,
  submissionSummarySchema,
  targetWriteSchema,
  targetSummarySchema,
  targetUpdateResponseSchema,
  paginatedResponseSchema,
  formSummarySchema,
  formVersionDetailSchema,
  organizationSummarySchema,
} from "../dist/index.js";

test("list query defaults are bounded and reject unknown filters", () => {
  assert.deepEqual(listQuerySchema.parse({}), { limit: 25 });
  assert.deepEqual(listQuerySchema.parse({ limit: "100", cursor: "abc" }), { limit: 100, cursor: "abc" });
  assert.equal(listQuerySchema.safeParse({ limit: "1000" }).success, false);
  assert.equal(listQuerySchema.safeParse({ cursor: "x", admin: "true" }).success, false);
});

test("assignment writes require an explicit reviewer and optimistic version", () => {
  const reviewerId = "8d493e2d-7500-4d5f-a148-05a7ff2127d0";
  assert.deepEqual(assignmentSetRequestSchema.parse({ reviewerId, expectedUpdatedAt: null }), { reviewerId, expectedUpdatedAt: null });
  assert.equal(assignmentSetRequestSchema.safeParse({ reviewerId }).success, false);
  assert.equal(assignmentSetRequestSchema.safeParse({ reviewerId, expectedUpdatedAt: null, organizationId: "attacker-controlled" }).success, false);
});

test("invitation and reset contracts bound secret and credential inputs", () => {
  assert.equal(invitationAcceptRequestSchema.safeParse({ email: "a@example.com", displayName: "A", password: "a".repeat(14) }).success, true);
  assert.equal(invitationAcceptRequestSchema.safeParse({ email: "bad", displayName: "A", password: "a".repeat(14) }).success, false);
  const token = "a".repeat(48);
  assert.equal(passwordResetRequestSchema.safeParse({ email: "a@example.com", token, password: "a".repeat(14) }).success, true);
  assert.equal(passwordResetRequestSchema.safeParse({ email: "a@example.com", token, password: "a".repeat(14), membershipId: "untrusted" }).success, false);
});

test("session and error response envelopes are strict and stable", () => {
  const session = {
    user: { id: "8d493e2d-7500-4d5f-a148-05a7ff2127d0", email: "a@example.com", displayName: "A" },
    organizationId: "e6c9e1b9-af95-45c3-82b7-4fe7e608a189",
    organizationName: "Workspace",
    membershipId: "29939b21-1d8b-4d94-980e-375d8972a205",
    sessionId: "33333333-3333-4333-8333-333333333333",
    role: "REVIEWER",
    csrfToken: "a".repeat(64),
  };
  assert.equal(sessionResponseSchema.safeParse(session).success, true);
  assert.equal(sessionResponseSchema.safeParse({ ...session, sessionId: null }).success, true, "older role-scoped sessions remain usable during reauthentication");
  assert.equal(sessionResponseSchema.safeParse({ ...session, passwordHash: "must-not-leak" }).success, false);
  assert.equal(apiErrorSchema.safeParse({ error: { code: "ASSIGNMENT_CHANGED", message: "Refresh.", requestId: "request-1" } }).success, true);
  assert.equal(apiErrorSchema.safeParse({ error: { code: "x", message: "x", secret: "leak" } }).success, false);
  const loginResponse = { sessionId: session.sessionId, user: session.user, organization: { id: session.organizationId, name: "Workspace", slug: "workspace" }, role: session.role, csrfToken: session.csrfToken };
  assert.equal(loginResponseSchema.safeParse(loginResponse).success, true);
  assert.equal(loginRequestSchema.safeParse({ email: "a@example.com", password: "password", organizationSlug: "my-workspace" }).success, true);
  assert.equal(workspaceChoiceResponseSchema.safeParse({ error: { code: "WORKSPACE_SELECTION_REQUIRED", message: "Choose a workspace." }, data: { workspaces: [{ id: session.organizationId, name: "Workspace", slug: "workspace", role: "REVIEWER" }] } }).success, true);
});

test("assignment response schemas match the bounded target list and mutation envelopes", () => {
  const targetId = "8d493e2d-7500-4d5f-a148-05a7ff2127d0";
  const reviewerId = "e6c9e1b9-af95-45c3-82b7-4fe7e608a189";
  const assignment = { id: "29939b21-1d8b-4d94-980e-375d8972a205", reviewerId, updatedAt: "2026-01-01T00:00:00.000Z", reviewer: { displayName: "Reviewer", email: "reviewer@example.com" } };
  assert.equal(assignmentListResponseSchema.safeParse({ data: [{ id: targetId, displayName: "Target", email: null, assignment }], nextCursor: null, counts: { total: 1, assigned: 1, unassigned: 0 } }).success, true);
  const page = Array.from({ length: 101 }, (_, index) => ({ id: `8d493e2d-7500-4d5f-a148-${String(index).padStart(12, "0")}`, displayName: "Target", email: null, assignment: null }));
  assert.equal(assignmentListResponseSchema.safeParse({ data: page, nextCursor: null, counts: { total: 101, assigned: 0, unassigned: 101 } }).success, false);
  assert.equal(assignmentMutationResponseSchema.safeParse({ data: { id: "29939b21-1d8b-4d94-980e-375d8972a205", organizationId: "d7a22eb1-57f7-41d4-965d-c91c8ef2a31f", targetId, reviewerId, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, changed: true }).success, true);
  assert.equal(assignmentRemoveResponseSchema.safeParse({ data: { removed: true } }).success, true);
  assert.equal(assignmentRemoveResponseSchema.safeParse({ data: { removed: true, reviewerId } }).success, false);
});

test("resource contracts validate target, member, and invitation DTOs without accepting secret fields", () => {
  assert.equal(loginRequestSchema.safeParse({ email: "admin@example.com", password: "password" }).success, true);
  assert.equal(loginRequestSchema.safeParse({ email: "admin@example.com", password: "password", role: "OWNER" }).success, false);
  assert.equal(targetWriteSchema.safeParse({ displayName: "Target", email: "target@example.com" }).success, true);
  assert.equal(targetWriteSchema.safeParse({ displayName: "Target", organizationId: "client-controlled" }).success, false);
  const member = {
    id: "8d493e2d-7500-4d5f-a148-05a7ff2127d0", organizationId: "e6c9e1b9-af95-45c3-82b7-4fe7e608a189", userId: "29939b21-1d8b-4d94-980e-375d8972a205",
    role: "REVIEWER", status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z",
    user: { id: "29939b21-1d8b-4d94-980e-375d8972a205", email: "reviewer@example.com", displayName: "Reviewer", status: "ACTIVE" },
    assignedTargetCount: 2, linkCount: 1,
  };
  assert.equal(memberSummarySchema.safeParse(member).success, true);
  assert.equal(memberListResponseSchema.safeParse({ data: [member] }).success, true);
  assert.equal(memberListResponseSchema.safeParse({ data: [{ ...member, user: { ...member.user, status: undefined } }] }).success, false);
  assert.equal(memberSummarySchema.safeParse({ ...member, passwordHash: "must-not-leak" }).success, false);
  assert.equal(targetSummarySchema.safeParse({ id: member.id, displayName: "Target", email: null, createdAt: member.createdAt, updatedAt: member.createdAt, submissionCount: 0, assignedReviewer: null }).success, true);
});

test("progress, public submission, and theme contracts are bounded and reject unknown/private inputs", () => {
  assert.equal(progressSummarySchema.safeParse({ activeTargets: 3, assignedTargets: 2, completedTargets: 1, responseCount: 1, unassignedTargets: 1, targetCount: 3, completionRule: "ONE_RESPONSE", completionPercent: 33.3 }).success, true);
  assert.equal(progressSummarySchema.safeParse({ activeTargets: -1, assignedTargets: 0, completedTargets: 0, responseCount: 0, unassignedTargets: 0, targetCount: 0, completionRule: "ONE_RESPONSE", completionPercent: 0 }).success, false);
  const tokenId = "8d493e2d-7500-4d5f-a148-05a7ff2127d0";
  assert.equal(submissionCreateRequestSchema.safeParse({ formId: tokenId, formVersionId: tokenId, targetId: tokenId, answers: {}, reviewerId: tokenId }).success, false);
  assert.equal(progressConfigSchema.safeParse({ targetCount: 100_001, completionRule: "ONE_RESPONSE" }).success, false);
  assert.equal(organizationThemeResponseSchema.safeParse({ accentColor: "#167354", fontPreset: "system", surfacePreset: "cool", formStyle: "soft", updatedAt: null }).success, true);
  assert.equal(organizationThemeResponseSchema.safeParse({ accentColor: "red", fontPreset: "system", surfacePreset: "cool", formStyle: "soft", updatedAt: null }).success, false);
});

test("form definitions and answer maps reject unknown keys and oversized answer collections", () => {
  assert.equal(formDefinitionSchema.safeParse({ title: "Review", description: "", fields: [], hidden: true }).success, false);
  assert.equal(formAnswersSchema.safeParse({}).success, true);
  const answers = Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, "value"]));
  assert.equal(formAnswersSchema.safeParse(answers).success, false);
});

test("forms, links, submissions, organization, and audit DTO contracts cover their public projections", () => {
  const id = "8d493e2d-7500-4d5f-a148-05a7ff2127d0";
  const date = "2026-01-01T00:00:00.000Z";
  const definition = { title: "Review", description: "", fields: [] };
  assert.equal(formSummarySchema.safeParse({ id, title: "Review", description: "", status: "DRAFT", updatedAt: date, currentPublishedId: null, submissionCount: 0 }).success, true);
  assert.equal(formVersionDetailSchema.safeParse({ id, formId: id, version: 1, publishedAt: date, createdAt: date, definition }).success, true);
  assert.equal(invitationCreatedSchema.safeParse({ id, email: null, displayName: null, role: "REVIEWER", expiresAt: date, createdAt: date, expired: false, canReveal: true, inviteUrl: `https://example.invalid/invite/${"a".repeat(48)}` }).success, true);
  assert.equal(reviewLinkSummarySchema.safeParse({ id, reviewerId: id, formId: id, createdAt: date, expiresAt: null, revokedAt: null, active: true, canReveal: true }).success, true);
  assert.equal(submissionReceiptSchema.safeParse({ data: { id, submittedAt: date, replay: false } }).success, true);
  assert.equal(submissionSummarySchema.safeParse({ id, formId: id, formVersionId: id, targetId: id, reviewerId: id, reviewedAt: null, archivedAt: null, submittedAt: date, target: { id, displayName: "Target" }, form: { id, title: "Review" }, reviewer: { user: { displayName: "Reviewer" } }, formVersion: { version: 1 }, reviewedPersonName: "Target" }).success, true);
  assert.equal(organizationSummarySchema.safeParse({ id, name: "Workspace", slug: "workspace", createdAt: date, updatedAt: date }).success, true);
  assert.equal(organizationSummarySchema.safeParse({ id, name: "Workspace", slug: "workspace", createdAt: date, updatedAt: date, passwordHash: "no" }).success, false);
  assert.equal(auditEventSummarySchema.safeParse({ id, actorId: null, action: "TARGET_ASSIGNED", entityType: "Assignment", entityId: id, createdAt: date, answers: "must-not-leak" }).success, false);
  const publicPayload = { data: { reviewerName: "Reviewer", theme: { accentColor: "#167354", fontPreset: "sans", surfacePreset: "mist", formStyle: "clean" }, targets: [{ id, displayName: "Target" }], forms: [{ id, title: "Review", description: "", versionId: id, definition }] } };
  assert.equal(publicReviewReadResponseSchema.safeParse(publicPayload).success, true);
});

test("people endpoints have strict target list, create, and update response contracts", () => {
  const id = "8d493e2d-7500-4d5f-a148-05a7ff2127d0";
  const date = "2026-01-01T00:00:00.000Z";
  const target = { id, displayName: "Alex Morgan", email: null, createdAt: date, updatedAt: date, submissionCount: 0 };
  assert.equal(paginatedResponseSchema(targetSummarySchema).safeParse({ data: [target], nextCursor: null }).success, true);
  assert.equal(paginatedResponseSchema(targetSummarySchema).safeParse({ data: [{ ...target, internalNotes: "leak" }], nextCursor: null }).success, false);
  assert.equal(targetUpdateResponseSchema.safeParse({ data: { id, displayName: "Alex Morgan", email: null } }).success, true);
  assert.equal(targetUpdateResponseSchema.safeParse({ data: { id, displayName: "Alex Morgan", email: null, passwordHash: "leak" } }).success, false);
});

test("team invitation, role update, and membership reset contracts match current API envelopes", () => {
  const id = "8d493e2d-7500-4d5f-a148-05a7ff2127d0";
  const date = "2026-01-01T00:00:00.000Z";
  assert.equal(invitationCreateRequestSchema.safeParse({ role: "REVIEWER" }).success, true);
  assert.equal(invitationCreateRequestSchema.safeParse({ role: "REVIEWER", organizationId: id }).success, false);
  assert.equal(invitationAcceptInfoSchema.safeParse({ data: { email: null, displayName: null, role: "REVIEWER", expiresAt: date } }).success, true);
  assert.equal(invitationAcceptResponseSchema.safeParse({ data: { accepted: true } }).success, true);
  assert.equal(invitationListResponseSchema.safeParse({ data: [{ id, email: null, displayName: null, role: "REVIEWER", expiresAt: date, createdAt: date, expired: false, canReveal: true }] }).success, true);
  assert.equal(invitationListResponseSchema.safeParse({ data: [{ id, email: null, displayName: null, role: "OWNER", expiresAt: date, createdAt: date, expired: false, canReveal: true }] }).success, false);
  assert.equal(invitationRevealResponseSchema.safeParse({ data: { inviteUrl: `https://example.invalid/invite/${"a".repeat(48)}` } }).success, true);
  assert.equal(invitationRevealResponseSchema.safeParse({ data: { inviteUrl: "javascript:alert(1)" } }).success, false);
  assert.equal(invitationRevealResponseSchema.safeParse({ data: { inviteUrl: `http://example.invalid/invite/${"a".repeat(48)}` } }).success, false);
  assert.equal(invitationRevealResponseSchema.safeParse({ data: { inviteUrl: `http://localhost:3000/invite/${"a".repeat(48)}` } }).success, true);
  assert.equal(memberUpdateRequestSchema.safeParse({ status: "ARCHIVED" }).success, true);
  assert.equal(memberUpdateRequestSchema.safeParse({}).success, false);
  assert.equal(memberUpdateResponseSchema.safeParse({ data: { id, organizationId: id, userId: id, role: "REVIEWER", status: "ACTIVE", createdAt: date } }).success, true);
  assert.equal(memberUpdateResponseSchema.safeParse({ data: { id, organizationId: id, userId: id, role: "REVIEWER", status: "ACTIVE", createdAt: date, passwordHash: "no" } }).success, false);
  assert.equal(passwordResetTokensResponseSchema.safeParse({ data: [{ id, expiresAt: date, createdAt: date, consumedAt: null, revokedAt: null, expired: false, active: true }] }).success, true);
  assert.equal(passwordResetTokenCreatedSchema.safeParse({ data: { id, token: "t".repeat(48), expiresAt: date, createdAt: date } }).success, true);
});
