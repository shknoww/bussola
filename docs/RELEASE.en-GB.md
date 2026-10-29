# Pilot release 0.1.0

[Português (Brasil)](RELEASE.md)

## Access

- App: https://bussola-mira.vercel.app
- Administration: https://bussola-mira.vercel.app/admin
- Source: https://github.com/shknoww/bussola
- On the owner's Mac, open `Abrir painel.command` in the project folder. It reads the access key from Keychain and opens administration. Do not share the resulting access link.

## Executed checks

- Syntax and Node suite: 31 passes, no failures; three opt-in checks run separately where applicable.
- Adversarial review: two reproduced P2 issues fixed — private DOM attributes erased on sign-out/pagehide, and known expired assertions removed by a local-clock timer without waiting for the network. Chromium regression tests are included.
- Native PostgreSQL migration and SQL assertions in a separate QA database; fixtures rolled back.
- Native concurrent sessions: one idempotent contribution and one publication/audit; the competing review receives a conflict.
- Real API/database: submission, idempotency, private access, approval, invalid sources, corrections, suspension, withdrawal and CSRF.
- Chromium and WebKit: complete visitor → administrator → second-browser workflow. Suspension appeared automatically within 60 seconds.
- Published site: HTTPS, database health, actual owner authentication, private queue and both languages. Widths 360, 390, 768 and 1440 px; no horizontal overflow, JavaScript errors or CSP violations observed.
- Published service worker: offline reopening in Chromium and WebKit; no API, administration or map tiles in its cache.
- Recovery: production snapshot restored separately. A populated QA snapshot containing 5 places, 10 contributions and 13 audit events was restored with matching counts and hashes, and no orphaned references.

Local HTTPS tests use a test certificate. Published checks use normal TLS verification. Mock API tests are labelled MOCK and are separate from real-database checks.

## Data and limits

The public database starts **empty**, with no invented places or allegations. Test fixtures are confined to QA. Real submissions can be reviewed and published through the panel without changing code.

This is a technical pilot, not an editorial launch with a curated catalogue. An operator, cover arrangements, genuine sources and legal review remain to be established.

- One owner access key; no staff invitations, separate roles or MFA. Sessions last up to eight hours. Sign-out removes the browser cookie but does not revoke a stolen copy. Rotating the session secret or owner key invalidates all sessions.
- Physical Android/Chrome and iPhone/Safari installation has not been tested. Automated WebKit is not a physical iPhone installation test.
- The 10,000-place / 50-concurrent-query / sub-800 ms p95 target has not been qualified. SQL tests cover 251 records, complete pagination and map aggregation above 200 points.
- Proximity sorting covers the current page only and is labelled accordingly. Administration queues/audit are not paginated yet.
- Daily backups are retained for 30 days on the same server. Logical restoration passed; total-server-loss protection still needs an off-site copy.
- Public OpenStreetMap tiles have no SLA; offline map downloading is not implemented.

## Operations

Production and QA use distinct databases. Data lives in the private `bussola` schema; an exact-path HTTPS gateway exposes only the application RPC. A dedicated-role JWT remains server-side. Secrets live in Keychain and encrypted Vercel variables, not in source.

Daily backup: 02:20 UTC. Rate-limit-hash cleanup: minute 17 of every hour. Both scripts were executed manually; their first scheduled run has not yet been observed.

The scoped database JWT expires on **27 January 2027 at 20:12 UTC**. Rotate it before then, update `BUSSOLA_DB_JWT` in Vercel and redeploy. Do not rotate the shared Supabase signing secret as an incidental step.

Use `infra/restore.sh` with a **new** `bussola_restore_NAME` database, the complete schema dump and the matching migration. It refuses other database names. Full restore places data before foreign keys/triggers; a naive data-only restore can fail on references or expired historical reviews. The public gateway function is restored from the versioned migration.

## Licensing

Original code: Apache-2.0 with Marcos Mendes's NOTICE. Original text and design: CC BY 4.0. Commercial reuse and adaptations are permitted subject to attribution and the licence terms. Third-party material retains its own licence.
