# ReviewRoom rebuild status audit — 2026-10-24

This is an evidence audit of the 49 tasks in `docs/superpowers/plans/2026-10-23-reviewroom-platform-rebuild.md`, not a claim that the rebuild is complete. “Complete” means source and local verification meet the task's acceptance criteria. A feature existing without its required integration, browser, staging, restore, or capacity evidence is marked partial.

## Summary

| Status | Count | Meaning |
|---|---:|---|
| Complete | 5 | Verified locally against the task's acceptance criteria. |
| Partial | 30 | Relevant source exists, but acceptance or evidence is incomplete. |
| Blocked | 5 | Requires Hostinger staging/account or production-shaped staging data unavailable in this environment. |
| Not started | 9 | No implementation/evidence found in this audit. |
| **Total** | **49** | |

## Task-by-task evidence

| Task | Status | Evidence and remaining work |
|---|---|---|
| 0.1 | Partial | Repository/runtime documentation exists, but current Hostinger account values and database version are not verified. The previous plan checkbox was inaccurate and is now cleared. |
| 0.2 | Partial | `docs/rebuild/test-environments.md` and `scripts/db-target-guard.mjs` exist. No isolated MySQL integration harness is present; local `.env` points to port 5307, where no listener was found. |
| 0.3 | Blocked | `docs/rebuild/current-workflow-baseline.md` contains routes and historical evidence, not current redacted staging screenshots/traces. No staging app was available. |
| 0.4 | Complete | `docs/rebuild/decisions.md` records the requested role, route, assignment, data, and Hostinger decisions. |
| 1.1 | Complete | `docs/rebuild/domain-model.md` contains the canonical entities and lifecycle diagrams. |
| 1.2 | Complete | Contracts cover the listed areas. OpenAPI YAML now parses; login/assignment request examples and a login response example are checked against shared Zod schemas. Contracts suite: 12/12. |
| 1.3 | Partial | `packages/domain/src/permissions.ts` and matrix tests exist; middleware and public review use the policy. Some reviewer-scoped submission/progress paths still rely on inline route scoping, and full route-by-route security coverage remains outstanding. |
| 1.4 | Complete | `docs/rebuild/route-map.md` records panel routes and page states. |
| 2.1 | Partial | Shared CSS variables and separate panel shells exist, but a complete documented semantic token system and theme/schema coverage are not verified. |
| 2.2 | Not started | No shared `apps/web/src/components/ui/` library or keyboard/touch accessibility suite was found. |
| 2.3 | Partial | Responsive layouts exist. This audit adds a 1050px Team Access reflow for assignment/member cards, but browser/device assertions at the plan's widths are still absent. |
| 2.4 | Partial | `apps/web/src/lib/api.ts` and API-client tests exist, but several feature files still call `fetch` directly; abort/stale, retry, and caching acceptance is not fully demonstrated. |
| 3.1 | Partial | Role-scoped opaque sessions and auth policy/tests exist. MySQL integration for expiry, revocation, cookie/CSRF and concurrency is missing. |
| 3.2 | Partial | Admin/reviewer audiences and separate session cookies/routes exist with unit tests; browser verification in one browser is missing. |
| 3.3 | Partial | Invitation/account setup routes and validation exist; end-to-end acceptance and expiry/replay tests against MySQL are missing. |
| 3.4 | Partial | Membership-scoped reset/revocation code and unit tests exist; database and browser lifecycle evidence is missing. |
| 3.5 | Partial | Helmet, rate limits, trust-proxy setting, body limits, CSRF, and shutdown handling exist. Hostinger proxy behavior and limits have not been verified against staging. |
| 4.1 | Complete | `packages/domain/src/assignment-policy.ts` plus deterministic tie-break/eligibility/version tests exist. |
| 4.2 | Partial | Prisma schema/migrations contain tenant and assignment constraints, but production-shaped MySQL concurrency/integrity tests are missing. |
| 4.3 | Partial | Assignment service uses transactions/locks and has unit-level coverage; MySQL race tests and multi-tenant transaction checks are absent. |
| 4.4 | Partial | Target CRUD, pagination, search, assignment summary, and auto-assignment code exist; MySQL and route authorization coverage is incomplete. |
| 4.5 | Partial | Team Access contains reviewer assignments, search/filters, assign/unassign and invitation UI. Browser E2E for invitation/auto-balance/conflict/mobile is missing. |
| 4.6 | Partial | People has target CRUD and read-only assignment context, but UI/API failure behavior and removal of duplicate controls have not been verified end to end. |
| 4.7 | Not started | No complete role/tenant/direct-ID/concurrent assignment security regression suite was found. |
| 5.1 | Partial | Form editor, supported field types and model tests exist; full field-by-field browser/editor workflow and save-conflict evidence is missing. |
| 5.2 | Partial | Versioned publication code/tests exist; MySQL immutable-version/concurrent-publish tests are missing. |
| 5.3 | Partial | Reviewer link create/reveal/rotate/revoke behavior and unit tests exist; expiry/token replay and DB/browser integration remain unverified. |
| 5.4 | Partial | Public renderer, submission validation, signature input model, and unit tests exist; full browser coverage across field types, token lifecycle and devices is missing. |
| 6.1 | Partial | Inbox/detail/archive code and unit tests exist; MySQL retention/scope integration and browser lifecycle coverage are missing. |
| 6.2 | Partial | Reviewer dashboard and personal-link flows exist; assignment-to-submission browser E2E is missing. |
| 6.3 | Partial | Progress API and unit metrics exist, but the plan's pure domain module and verified edge/browser cases are not complete. |
| 6.4 | Partial | Workspace settings/theme code and tests exist; cross-panel/public browser save/conflict checks are missing. |
| 6.5 | Partial | Audit events are written and an audit endpoint/UI exists; full filter/pagination and PII-redaction review is unverified. |
| 7.1 | Not started | No field-by-field migration map was found. |
| 7.2 | Not started | No non-destructive source-data preflight/dry-run scripts were found. |
| 7.3 | Not started | No resumable checkpointed backfill tool or restart/idempotency tests were found. |
| 7.4 | Not started | No restore rehearsal or completed cutover runbook exists. |
| 7.5 | Partial | Legacy route families remain in the route map and current app; compatibility telemetry/contract tests are missing. |
| 8.1 | Partial | `.github/workflows/ci.yml` covers basic install/typecheck/lint/unit/build/audit steps. Root `npm test` now generates the ignored Prisma client using a loopback-only test fallback when no DB settings are supplied; clean-worktree verification passed 205 tests without connecting to MySQL. CI still has no MySQL service, migration/integration jobs, Playwright configuration, fixtures/seed helpers, or browser stage. |
| 8.2 | Not started | No `apps/web/e2e/` workflow suite was found. |
| 8.3 | Partial | Some accessibility and signature unit tests exist; axe, keyboard/browser matrix, manual device checks and documented results are absent. |
| 8.4 | Partial | A historical security audit and current source controls exist; a fresh targeted security review and residual-risk record remain outstanding. |
| 8.5 | Blocked | `scripts/local-load-check.mjs` is only a capped smoke profile. No staging/production-sized DB was available for expected/3x/burst measurements. |
| 8.6 | Partial | On 2026-10-24 with Node 24.12.0/npm 11.6.2, fresh-worktree `npm ci`, `npm run lint`, `npm run typecheck`, root `npm test` (205 tests, no DB variables), and `npm run build` passed. Build/typecheck used safe placeholder values and did not connect to MySQL. MySQL integration/E2E, Hostinger standalone packaging, DB-ready smoke, and restore evidence remain incomplete. |
| 9.1 | Blocked | Hostinger operation search works, but read-only deployment queries for both live sites did not return. Node/entry/output snippets are from historical user-provided logs, not verified current account settings or plan limits. |
| 9.2 | Blocked | No isolated staging apps/database or staging secrets are configured. |
| 9.3 | Blocked | Requires the staging apps and database from 9.2. |
| 9.4 | Not started | Incident, restore, Hostinger rollback, and credential-rotation runbooks were not found. |
| 9.5 | Not started | No release packet with staging reconciliation, load, restore, and rollback evidence exists. |

## Verification run in this audit

- Node/npm: lockfile install completed (`npm ci`).
- `npm run lint`: pass.
- `npm run typecheck`: pass with safe temporary environment placeholders; Prisma client generated successfully.
- `npm test`: contracts 12, domain 11, API 118, web 68; **209 passed, 0 failed**.
- `npm run build:hostinger:web`: pass; Next.js standalone package prepared at `apps/web/.next/hostinger`.
- `npm audit --omit=dev`: pass after updating `body-parser` from 2.3.0 to 2.4.0; zero production vulnerabilities reported.
- Temporary API/web production processes returned HTTP 200 for `/health`, `/api/v1/health/live`, and `/admin/login`; stopped after the smoke check because no isolated DB was configured and the build-time API origin was production.
- Browser-based responsive visual verification, migration/integration tests, DB readiness, E2E, restore, and load testing were not run.

## Production error evidence and limitation

The supplied Hostinger logs show `PrismaClientKnownRequestError` code `P2039` on API requests. Prisma documents P2039 as an unmapped database-driver error; the specific underlying database cause is not present in the supplied log. Read-only Hostinger deployment calls timed out during this audit, so the currently deployed API build and current live `/admin/people` request could not be correlated. The production HTTP 500 is therefore **not verified fixed**.

## Release boundary

The rebuild is **not complete or ready for production cutover**. There are 5 complete tasks, 30 partial tasks, 5 staging/account-blocked tasks, and 9 not-started tasks. This audit makes no production migration, deployment, DNS change, or GitHub push. Production cutover and the plan's separately authorized release step remain pending.
