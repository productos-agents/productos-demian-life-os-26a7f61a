# DEMIAN CORE — Security, Privacy and Recovery Runbook

## Database migrations
- Migrations live in db/migrations/ and are applied by npm run migrate during Railway's pre-deploy phase.
- The runner records each migration name and SHA-256 checksum in public.demian_schema_migrations.
- Once applied, a migration file is immutable. Create a new numbered migration for every later schema change.
- The current migration is additive: it adds a nullable email-verification timestamp and creates session, password-reset, and privacy-request tables. It does not drop or rewrite user data.

## Data export and privacy requests
- A signed-in user can download a JSON export at /api/privacy/export; it includes personal records and the linked FLUX history and excludes password hashes and push-notification secrets.
- Access, correction and deletion requests are saved in public.demian_privacy_requests.
- Requests are not a self-executing deletion job. The responsible operator must review the request, inventory records in both DEMIAN and FLUX, remove the account's rows in a verified order, confirm no residual user-linked data remains, and only then mark the request complete.
- Never remove a user directly from demian_users without first reviewing foreign keys and rows in both DEMIAN and FLUX. The databases cannot share one atomic transaction.

## Password recovery
- Recovery links are random, stored only as SHA-256 hashes, expire after 30 minutes, and are single-use.
- Completion changes the password and revokes all registered sessions in the same DEMIAN database transaction.
- Email delivery requires Railway variables RESEND_API_KEY and DEMIAN_EMAIL_FROM. Set the sender to an address/domain verified in Resend. Optionally set DEMIAN_PUBLIC_URL to the canonical HTTPS application URL.
- If email delivery variables are absent or delivery fails, the flow reports that recovery is unavailable and does not pretend an email was sent.

## Backups and restore tests
- The app JSON export is a portability feature, not a database backup.
- Verify the database provider's automated backup/snapshot policy and retention separately for both DEMIAN_DATABASE_URL and FLUX_DATABASE_URL; do not assume it is enabled by this code.
- For an additional protected backup, use the provider's supported PostgreSQL backup/export mechanism or pg_dump --format=custom --no-owner into an encrypted, access-restricted destination. Never commit dumps, environment files, or connection strings to the repository.
- Test recovery only into isolated, disposable databases. Restore each database separately, apply migrations, verify row counts and ownership relationships, and test the app against the isolated URLs before calling the restore procedure validated.
- Do not test restore over production databases. Record the restore date, snapshot identifier, versions, and validation results in an operator-only record.

## Session revocation
- Each new session has a server-side record paired with the signed, HTTP-only cookie.
- Protected page/API requests confirm that the session record exists, has not been revoked, and has not expired.
- Logout revokes the current session server-side. Password recovery revokes all sessions for the account.
