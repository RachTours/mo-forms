# ReviewRoom architecture

## Request path

```text
Browser
  └─ Next.js App Router (server-rendered workspace pages + focused client actions)
       └─ same-origin /api rewrite
            └─ Express REST API
                 ├─ auth, role, CSRF, validation, rate-limit middleware
                 ├─ domain modules (forms, members, targets, assignments, links, submissions, progress)
                 ├─ packages/contracts (shared schemas and API contracts)
                 ├─ packages/domain (shared permission and assignment policy)
                 └─ Prisma 7 + MariaDB adapter → MySQL
```

The API is the authority for permissions and business rules. The web layer forwards the HttpOnly session cookie for server rendering and uses same-origin browser requests for mutations. Zod schemas in `packages/contracts` are shared between the web app and API; pure permission and assignment-policy rules live in `packages/domain`. The API still validates every request independently and remains the only layer that authorizes persisted data.

## Domain boundaries

| Module | Owns | Important rule |
| --- | --- | --- |
| Auth | users, memberships, sessions, bootstrap, role-specific sign-in | Store password hashes on Membership so admin and reviewer credentials are independent; hash session tokens and bind sessions to one active membership. |
| Forms | draft definitions and published versions | A publication is immutable; submissions point to the version they answered. |
| Targets | review target lifecycle | People are created, edited, and archived independently from reviewer assignment. |
| Assignments | current target-to-reviewer relation, assignment list, and audit changes | One active reviewer per target; active target and reviewer must share an organization; new targets and unassigned targets are balanced across active reviewers; stale writes conflict. |
| Links | private reviewer access links | Store only token hashes; rotate/revoke independently; expire after 90 days. |
| Submissions | public answer validation and review inbox | A link can submit only for targets assigned to its reviewer and current published form versions. |
| Members | invitations, one-time password-reset tokens, and team access | Owner/admin capabilities are checked at the API boundary; reset changes only the selected membership credential; removing a reviewer revokes sessions and links. |
| Organization | workspace identity and allowlisted appearance | Theme values are organization-scoped, allowlisted, and exposed read-only to reviewers/public form links. |
| Progress | configured goal and derived counts | Completion is derived from active targets and non-archived submissions, never manually edited. |
| Audit | organization-scoped activity | Record actor/action/entity metadata, not answer payloads or raw secrets. |

Operational records carry `organizationId`. API reads and writes are scoped to the authenticated organization, and relationships that cross records are verified against that same organization before mutation. Archived records preserve history while leaving active lists and progress calculations.

## Form extension path

Add a new field type in `packages/contracts/src/forms.ts` first. Extend the discriminated union with its configuration, then add the field editor controls and live preview in `apps/web/src/features/forms/form-editor.tsx`, add its public renderer in `apps/web/src/features/review/review-portal.tsx`, and implement authoritative validation in `apps/api/src/modules/submissions/answer-validator.ts`. The shared schema enforces field-definition constraints; the API validator enforces answer constraints. Published form versions are snapshots, so a new field does not reinterpret historical submissions.

The current field catalog includes full name, short/long text, email, URL, phone, yes/no, number, single choice, checkboxes, dropdown, rating, date, consent, ranking, and signature. Ranking answers are arrays containing every option ID exactly once. Order is represented by array position, and the interface does not label choices with numeric ranks. A signature is either a bounded typed name or normalized pointer strokes; it is not a qualified/legal digital-signature service.

## API surface

All endpoints are under `/api/v1`.

| Resource | Routes |
| --- | --- |
| Auth | `POST /auth/login` (legacy chooser), `POST /auth/admin/login`, `POST /auth/reviewer/login`, `POST /auth/password-reset`, `GET /auth/session`, `POST /auth/logout` |
| Forms | `GET/POST /forms`, `GET/PATCH/DELETE /forms/:formId`, `POST /forms/:formId/publish`, `POST /forms/:formId/restore`, `DELETE /forms/:formId/permanent` |
| Targets | `GET/POST /review-targets`, `GET /review-targets/assignment-options`, `PATCH/DELETE /review-targets/:targetId`, `POST /review-targets/assignments/bulk`; legacy per-target assignment routes delegate to Assignments |
| Assignments | `GET /assignments`, `PUT /assignments/:targetId`, `DELETE /assignments/:targetId` |
| Members | `GET /members`, invitation inspect/accept/revoke/rotate/reveal, `GET/POST/DELETE /members/:membershipId/password-reset-tokens`, `PATCH/DELETE /members/:membershipId`, `DELETE /members/:membershipId/permanent` |
| Links | reviewer/admin list, personal/admin rotation, revoke |
| Public review | `GET /public/review/:token`, `POST /public/review/:token/submissions` |
| Submissions | paginated active/archived lists, detail, reviewed/reopened, archive/restore, permanent deletion |
| Progress | `GET /progress/summary`, `GET /progress/reviewer-board`, `PATCH /progress/config` |
| Workspace | `GET/PATCH /organization`, `GET/PUT /organization/theme`, `GET /audit-events` |
| Health | `/health/live`, `/health/ready` |

Responses use a `{ data }` envelope for successful JSON reads/writes and a stable `{ error: { code, message, requestId } }` shape for errors. Lists use bounded page sizes and cursor pagination at the API boundary.

## Scaling and operations

- API instances persist sessions, review links, forms, and submissions in MySQL. Rate-limit counters are in-memory and per API process; multiple replicas do not share quotas. For horizontal scaling, apply shared abuse limits at the hosting gateway/WAF (no Redis service is part of this project).
- Prisma’s MariaDB adapter uses a connection pool of 10 per API process. Set the process replica count and database connection budget together; lower the pool size when scaling out.
- Queries are organization-scoped and have indexes for target status/name, assignment reviewer, form status/update, submission target/reviewer/time, audit time, and invitation state.
- Assignment foreign keys include `organizationId`, so MySQL rejects cross-organization relations even if a future application path omits a scope check. `Assignment.updatedAt` is the optimistic concurrency version; same-reviewer retries are idempotent and stale writes conflict.
- Team access owns reviewer assignment controls. People manages review targets only. New targets are assigned to the least-loaded active reviewer; when a reviewer joins or becomes active, existing unassigned targets are balanced across active reviewers. Existing assignments stay put until an administrator changes them. Archiving a target removes and audits its current assignment; removing/promoting a reviewer redistributes eligible targets while preserving submissions.
- Hostinger API deployment runs a read-only assignment integrity preflight before migrations. It stops when existing assignments have missing or cross-organization relations; operators must review and repair those rows explicitly rather than having a migration discard them.
- Public targets/forms and admin list endpoints have hard result caps. If a workspace outgrows those caps, add cursor controls to the UI before raising them.
- Readiness checks MySQL. Liveness is independent of dependencies. SIGINT/SIGTERM shuts down HTTP and Prisma cleanly.
- The app does not require Docker or Redis. phpMyAdmin is an optional database administration tool supplied by the hosting environment; production uses managed/private MySQL, HTTPS, unique secrets, TLS verification, backups, and monitoring.

## Authorization model

- **Owner:** full workspace control, including granting admin access.
- **Admin:** manage forms, people, assignments, progress, submissions, invitations, and reviewer links.
- **Reviewer:** see assigned targets and own submissions, and create/manage a personal link.
- **Public link holder:** no workspace session. Can read only the link holder’s assigned targets and published form versions, and submit validated responses for those targets.

Mutations require a session-bound CSRF token and exact same-origin request verification. Review links are bearer secrets: they are generated with cryptographic randomness, hashed at rest, revealed only on creation/rotation, and invalidated on rotation, revocation, membership removal, or expiry.

## Current authentication and appearance

The global `User` is an email/display-name identity only. Its former shared password hash was moved into `Membership.passwordHash` by migration `202610220005_membership_credentials`, preserving existing credentials while allowing each workspace role membership to change independently. Role-specific login endpoints filter eligible memberships before checking that membership's password hash. Admin-issued password reset tokens are separate from invitation tokens, expire after 30 minutes, are stored as hashes, and reset only the target membership's password/sessions.

The initial appearance feature stores an allowlisted accent color, font preset, surface preset, and form style in `OrganizationTheme`. Settings are owner/admin write, workspace members read. CSS variables apply across the admin/reviewer shell and public review forms. Logo upload and arbitrary custom CSS/font URLs remain future work.
