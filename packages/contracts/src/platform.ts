import { z } from "zod";
import { roles } from "./roles.js";

export const stableErrorCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/);

export const apiErrorSchema = z.object({
  error: z.object({
    code: stableErrorCodeSchema,
    message: z.string().min(1).max(500),
    requestId: z.string().min(1).max(128).optional(),
    details: z.array(z.object({ path: z.array(z.union([z.string(), z.number()])), code: z.string().max(64), message: z.string().max(240) }).strict()).max(50).optional(),
  }).strict(),
}).strict();

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).max(256).optional(),
}).strict();

export const listResponseSchema = <T extends z.ZodType>(itemSchema: T) => z.object({
  data: z.array(itemSchema).max(100),
  nextCursor: z.string().min(1).max(256).nullable(),
}).strict();

export const loginRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
  organizationSlug: z.string().trim().min(1).max(80).toLowerCase().optional(),
}).strict();

export const loginResponseSchema = z.object({
  sessionId: z.string().uuid(),
  user: z.object({ id: z.string().uuid(), email: z.string().email(), displayName: z.string().min(1).max(120) }).strict(),
  organization: z.object({ id: z.string().uuid(), name: z.string().min(1).max(160), slug: z.string().min(1).max(80) }).strict(),
  role: z.enum(roles),
  csrfToken: z.string().length(64),
}).strict();

export const sessionResponseSchema = z.object({
  user: z.object({ id: z.string().uuid(), email: z.string().email(), displayName: z.string().min(1).max(120) }).strict(),
  organizationId: z.string().uuid(),
  organizationName: z.string().min(1).max(160),
  membershipId: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: z.enum(roles),
  csrfToken: z.string().length(64),
}).strict();

export const workspaceChoiceResponseSchema = z.object({
  error: z.object({ code: z.literal("WORKSPACE_SELECTION_REQUIRED"), message: z.string().min(1).max(500), requestId: z.string().min(1).max(128).optional() }).strict(),
  data: z.object({ workspaces: z.array(z.object({ id: z.string().uuid(), name: z.string().min(1).max(160), slug: z.string().min(1).max(80), role: z.enum(roles) }).strict()).min(1).max(100) }).strict(),
}).strict();

export const assignmentSetRequestSchema = z.object({
  reviewerId: z.string().uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict();

export const assignmentTargetSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(160),
  email: z.string().email().max(254).nullable(),
  assignment: z.object({
    id: z.string().uuid(),
    reviewerId: z.string().uuid(),
    updatedAt: z.iso.datetime({ offset: true }),
    reviewer: z.object({ displayName: z.string().min(1).max(120), email: z.string().email().max(254) }).strict(),
  }).strict().nullable(),
}).strict();

export const assignmentListResponseSchema = z.object({
  data: z.array(assignmentTargetSchema).max(100),
  nextCursor: z.string().uuid().nullable(),
  counts: z.object({ total: z.number().int().nonnegative(), assigned: z.number().int().nonnegative(), unassigned: z.number().int().nonnegative() }).strict(),
}).strict();

export const assignmentMutationResponseSchema = z.object({
  data: z.object({ id: z.string().uuid(), organizationId: z.string().uuid(), targetId: z.string().uuid(), reviewerId: z.string().uuid(), createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }) }).strict(),
  changed: z.boolean(),
}).strict();
export const assignmentRemoveResponseSchema = z.object({ data: z.object({ removed: z.boolean() }).strict() }).strict();

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  token: z.string().min(40).max(100),
  password: z.string().min(14).max(1024),
}).strict();

export type ApiError = z.infer<typeof apiErrorSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type WorkspaceChoiceResponse = z.infer<typeof workspaceChoiceResponseSchema>;
export type AssignmentSetRequest = z.infer<typeof assignmentSetRequestSchema>;
export type AssignmentTarget = z.infer<typeof assignmentTargetSchema>;
export type AssignmentMutationResponse = z.infer<typeof assignmentMutationResponseSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
