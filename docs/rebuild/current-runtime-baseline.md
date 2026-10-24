# ReviewRoom Current Runtime Baseline

**Captured:** 2026-10-24
**Scope:** Repository inspection and local verification in an isolated worktree. No Hostinger account, deployed runtime, live database, or secret store was accessed.

## What this baseline does and does not establish

This document records what the checked-out repository requires and what its local test suite exercised. It does **not** prove the current Hostinger applications, selected Node runtime, configured domains/origins, entry/output paths, environment values, database host/version, schema state, or plan limits. The Hostinger deployment guide describes the repository's intended configuration; validate every live setting in the relevant Hostinger account or staging environment before treating it as operational fact.

## Repository and runtime inventory

- The root is an npm workspace monorepo: `apps/*` and `packages/*`. Its declared Node engine is `>=22.12 <23 || >=24 <25`; the root package manager is npm `11.6.2`.
- `apps/web` is a Next.js 16.4.2 / React 19 App Router application. `next.config.ts` selects standalone output, repository-root tracing, and resolves `API_INTERNAL_URL` while the web build runs. `npm run build:hostinger:web` prepares `apps/web/.next/hostinger/server.js` plus the traced runtime dependencies, shared packages, and static assets.
- `apps/api` is an Express 5 / TypeScript service using Prisma 7 and `@prisma/adapter-mariadb`; its compiled start entry is `apps/api/dist/server.js`. `PORT` overrides the local `API_PORT` setting.
- `packages/contracts` owns shared API/form schemas and OpenAPI contracts. `packages/domain` owns pure permission and assignment-policy rules shared by the API and its tests.
- Prisma's schema is `apps/api/prisma/schema.prisma`. Eleven committed migrations end at `202610230001_assignment_integrity`. The generated Prisma client is intentionally ignored at `apps/api/src/generated/` and must be produced before API compilation.

## Current application surface

- API route modules cover auth, members, targets, assignments, forms, reviewer links, public review/submissions, progress, organization, and audit events. `apps/api/src/app.ts` mounts application routes below `/api/v1`; liveness is available at `/health` and `/api/v1/health/live`, while `/api/v1/health/ready` queries MySQL.
- The web app exposes role-scoped admin and reviewer entry/login URLs, rewrites those URLs to shared authenticated workspace pages, and keeps public invitation, password-reset, and reviewer-link submission routes. `docs/routing-and-workspace-architecture.md` is the route contract. Rewrites are routing only; server-side page checks and API middleware remain authorization boundaries.
- The data model includes Organization, User, Membership, Session, Form, FormVersion, ReviewTarget, Assignment, ReviewLink, Submission, ProgressConfig, OrganizationTheme, Invitation, PasswordResetToken, and AuditEvent. Key constraints include one assignment per organization/target and same-organization composite foreign keys for assignments; form versions are unique per form/version; submissions retain form-version, target, reviewer, idempotency-key, and payload-hash evidence.
- `.env.example` documents safe key names and placeholders only. API configuration accepts component `DB_*` settings (or compatibility `DATABASE_URL`), session/origin settings, optional `TOKEN_ENCRYPTION_KEY`, and optional `TRUSTED_PROXIES`. The API Hostinger build script generates Prisma, runs assignment-integrity preflight and migrations, builds contracts/domain, optionally bootstraps a first owner, then builds the API. It therefore needs staging validation, backup, and restore rehearsal before production use.

## Fresh-worktree verification

The following PowerShell commands were run in this isolated worktree. All values are local test placeholders; none are credentials.

| Command | Result |
| --- | --- |
| `npm ci` | Passed: 574 packages installed; audit reported 0 vulnerabilities. |
| `$env:SESSION_SECRET='test-only-session-secret-000000000000000000000000'; $env:WEB_ORIGIN='http://localhost:5000'; $env:NODE_ENV='test'; $env:DB_HOST='127.0.0.1'; $env:DB_PORT='3306'; $env:DB_NAME='reviewroom_test_unused'; $env:DB_USER='reviewroom_test_unused'; $env:DB_PASSWORD='reviewroom_test_unused'; npm test` after the ignored generated Prisma client was absent | Failed during the API TypeScript build because `src/generated/prisma/client.js` was missing. The downstream implicit-type errors are consequences of that missing generated module. |
| `$env:DATABASE_URL='mysql://reviewroom_test_unused:reviewroom_test_unused@127.0.0.1:3306/reviewroom_test_unused'; npm run db:generate` | Passed and generated the Prisma client locally. Prisma loaded its configuration and schema; this command did not run migrations or connect to MySQL. |
| The same safe `SESSION_SECRET`, `WEB_ORIGIN`, `NODE_ENV`, and `DB_*` placeholder assignments followed by `npm test` | Passed: contracts 12, domain 11, API 118, web 68. |

The test configuration uses loopback placeholder database values only to satisfy configuration parsing. The test suite did not connect to MySQL: its database-facing cases use fakes/mocks, and the only ready-check test asserts behavior without querying after graceful shutdown begins. No migration, staging deployment, browser E2E, load test, backup/restore rehearsal, or live Hostinger verification was performed.

## Required live-environment confirmation

Before deployment parameters are locked, confirm directly in the intended Hostinger account or staging environment:

1. That two Node.js applications exist for the web and API services, and their current domains, repository revision, root/build/output/entry settings, and port behavior match the intended guide.
2. The selected Node runtime and plan limits (application slots, process/memory, timeout, and routing behavior).
3. The actual HTTPS origins, API reachability, CORS/cookie/CSRF behavior, and build-time `API_INTERNAL_URL` value.
4. The database host, engine/version, credentials, migration state, capacity, backups, and a restore rehearsal.

None of these facts can be inferred safely from the repository, historical documentation, screenshots, or prior build output.
