# DEMIAN CORE V1.8.0 — 2026-10-18

## Production
- URL: https://demian-life-os-web-production.up.railway.app
- Railway deployment: `5c801f47-e002-4142-8d1c-f59e348f90c8`
- Commit: `b64d1dee3718e257b6a79e7943966a25ab17a74a`
- Status: SUCCESS; production service Ready.
- Local production build succeeded.
- `npm run typecheck` passed; `npm run test:smoke` passed 19/19.
- Live HTTP: `/login`, `/recover`, `/privacy` returned 200; unauthenticated `/privacy/requests` redirected to login (307); `/api/auth` returned unauthenticated status; private search, data, finance, wellness, export, and privacy-request APIs returned 401.

## Shipped
- Global search queries owner-scoped DEMIAN records and all FLUX transaction history server-side, with a bounded result set and graceful fallback when FLUX is unavailable.
- Habit tracking respects daily, weekday (Mon–Fri), weekly and monthly cadence; personalized habits are tracked separately from scheduled compliance.
- Finance filtering now uses Mexico-local date boundaries; historical transaction search is server-side and paginated; dashboard/report totals and budget period helpers are tested.
- Server-side session registry plus server-enforced revocation on logout; password reset revokes all sessions.
- Additive PostgreSQL migration tracking by SHA-256 checksum; route/database permissions for session, recovery token, and privacy request tables were verified for the app role.
- Public privacy notice, authenticated JSON data export, and logged access/correction/deletion requests. Deletion requests are not destructive automated jobs; the responsible operator must manually verify complete deletion across both databases before marking a request resolved.
- Password reset routes and UI are implemented. Email delivery is **not operational yet** because Railway lacks `RESEND_API_KEY` and `DEMIAN_EMAIL_FROM`; the endpoint returns a clear 503 until a verified sender and API key are configured.

## Database migration
- Neon project: `proud-cherry-76495193`, default branch `br-wispy-water-b5lkr6x1`.
- DEMIAN database: `demian_life_os`; FLUX database: `mi_dinero`.
- Applied `db/migrations/0001_security_privacy.sql` with database-owner privileges; checksum recorded as `7956dfaf9665cbf557fec5abe11045d52c18e1cd3d83e8e4ba07700ff1da71ab`.
- Verified `demian_life_os_app` can read the migration ledger and has the minimum table privileges used by session, token, and privacy-request routes.
- The production app role intentionally has no CREATE privilege in schema `public`. Railway pre-deploy `npm run migrate` verifies already-applied checksums and will fail closed when an unapplied migration needs owner privileges. Future production migrations must be applied by the database owner, recorded with the exact checksum, and granted to the app role before deployment.

## Recovery snapshot and limitations
- Manual Neon snapshot created before migration: `snap-red-sea-b54d1iov`, name `demian-core-before-v1-8-security`, created `2026-10-18T05:25:49Z`, expires `2026-11-17T00:00:00Z`.
- It captures the Neon project's default branch, including both DEMIAN and FLUX databases, before the additive schema change. A second snapshot attempt was refused because the project's snapshot limit was reached.
- Neon rejected automatic snapshot schedule setup with: “backup schedule creation is not enabled for this project.” No recurring snapshot schedule is configured. The project currently reports `history_retention_seconds=21600` (6 hours). Do not claim long-term automated backup or a tested restore.
- No production snapshot has been restored for test. Restore validation remains unproven; perform future recovery tests only on an isolated branch.
- Recovery email secrets must be configured manually by an authorized operator. Do not commit provider keys or database connection strings.
