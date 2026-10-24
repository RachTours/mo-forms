# Task 8.1 scoped increment: generate Prisma before root tests

## Scope

Updated the root `test` script to run the existing `db:generate` script before workspace tests. This prevents API TypeScript compilation from failing when a clean install has no ignored generated Prisma client. No migration, database connection, integration setup, browser configuration, seed, CI, or unrelated source changes were added.

## TDD evidence

### RED

Removed only the generated `apps/api/src/generated/prisma` directory from the worktree and ran `npm test`. Contracts (12) and domain (11) passed, then API compilation failed because modules could not resolve `../generated/prisma/client.js`; the subsequent implicit-any errors followed from that missing client. This reproduced the reported clean-install failure.

### GREEN

After the root script change, `npm run db:generate` generated Prisma Client 7.10.1 without connecting to MySQL. Since the repository's Prisma config requires `DATABASE_URL` while loading, verification used a placeholder local URL (`mysql://user:pass@127.0.0.1:3306/reviewroom`) and test-only `SESSION_SECRET`, `WEB_ORIGIN`, and `NODE_ENV=test` values. No database service was started or contacted; no migration was run.

Ran focused `npm run db:generate` successfully, then ran root `npm test` successfully: 12 contracts, 11 domain, 113 API, and 68 web tests passed. Total: 204 passed, 0 failed.

## Change

`package.json`: root `test` now starts with `npm run db:generate &&` before the existing workspace test sequence.
