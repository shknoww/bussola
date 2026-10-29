# Backend Bússola — integration handoff

## Runtime

Node 22+, ES modules, **no runtime dependencies**. `api/index.js` exports Vercel's default `(req,res)` handler. `node server/dev.mjs` serves `public/` and the same API; accepts `PORT` (3000 default), `HOST` (127.0.0.1 default) and injected environment variables. It does not read dotenv files, collect contacts, fetch source URLs, emit request logs or enable analytics.

Set these **server-only** variables from the owner's secret store:

- `SUPABASE_URL`: HTTPS base URL, e.g. `https://bussola-db.65.108.92.110.sslip.io`. The client appends `/rest/v1/rpc/bussola_gateway`.
- `BUSSOLA_DB_JWT`: scoped JWT whose `role` is `bussola_api`; not a service-role JWT.
- `SUPABASE_API_KEY`: optional gateway `apikey` header. Can be omitted for the exact-path direct PostgREST proxy.
- `ADMIN_TOKEN_HASH`: hex SHA-256 of the high-entropy owner token. Only the owner token belongs in Keychain; never put it in source, URL parameters or browser storage.
- `SESSION_SECRET`, `RATE_LIMIT_SALT`: independently generated secrets, at least 32 characters.
- `NODE_ENV=production` on deployment. Vercel supplies `VERCEL=1`; the limiter then trusts only `x-vercel-forwarded-for`, not arbitrary `x-forwarded-for`.

Vercel rewrite: `/api/:path*` → `/api/index?path=:path*`. A true URL pathname is parsed separately from its query; the routing parameter is consumed only at `/api/index` or `/api/index.js`. A user's ordinary `path` query cannot invoke an admin route.

All responses are JSON and `no-store`. Upstream errors are sanitized. Writes require the same-host Origin when Origin/Fetch Metadata is present; originless non-browser public submissions are allowed. **Every admin write including logout requires a valid session, same-origin Origin and matching CSRF header, except login which creates the session.** Login itself requires same origin and is rate-limited.

Cookies use `__Host-`, Secure, HttpOnly, SameSite=Strict, an eight-hour expiry and HMAC signatures. Changing the owner token hash or session secret invalidates all sessions. Logout removes the current browser cookie; this stateless pilot does not maintain an individual-session revocation list. Local browser admin QA should use localhost's Secure-cookie exception or HTTPS, never weaken production cookie flags.

## Database application — operator only

1. Apply `supabase/001_bussola.sql` **once** in the production database as its administrator, and separately in `bussola_qa`.
2. The migration creates only the isolated `bussola` schema, application objects, the public gateway and a narrowly scoped global `bussola_api` role. It reuses that role across databases only after checking dangerous attributes/memberships, and grants membership to existing `authenticator`. It installs no extensions and changes no existing table/configuration. Existing `bussola` schema causes an intentional failure; do not reapply blindly.
3. Grant surface: only `public.bussola_gateway(text,jsonb)` execution to `bussola_api`, no private-schema/table/helper access. PUBLIC/anon/authenticated are denied this gateway. All application tables have RLS with no direct-access policies. The security-definer function fixes `search_path` and UTC timezone. Its owner must remain a trusted administrator, not an application login.
4. Expose only the exact gateway RPC through the dedicated HTTPS proxy. Never expose scoped JWTs to the frontend. Reload the appropriate PostgREST schema cache after the new function is applied using the operator's established procedure.
5. Schedule `supabase/maintenance.sql` hourly as the schema owner for physical deletion of expired rate buckets even when traffic stops. The API also deletes expired buckets opportunistically on every rate-limited operation. Buckets expire after 15 minutes for login or one hour for contributions; hashes rotate by UTC day. Without scheduled maintenance, expired hashes can remain on disk until the next write; this is **not** a claimed hard physical TTL.
6. Keep infrastructure access logs disabled/redacted for request queries, tokens, raw IP addresses and private bodies; application code itself logs none of these. Existing proxy/provider logging is outside this migration's scope.

The server role is trusted to call administrative gateway operations: HTTP authentication and CSRF are enforced by Node, not by an end-user Supabase token. Protect `BUSSOLA_DB_JWT` accordingly. The dedicated exact-path proxy is also important because PostgreSQL roles necessarily inherit privileges granted to PUBLIC on pre-existing objects; this migration does not rewrite unrelated grants.

## Behavior notes

- Base contains no fixtures. Contributions are pending and private; unknown/contact fields are rejected.
- Idempotency keys are globally unique across suggestion/correction operations. Same canonical payload returns its original `{id,status:'pending'}` even after moderation; changed payload or target returns 409.
- Row locks and expected revisions make moderation atomic with immutable audit snapshots. Corrections additionally capture the target establishment revision and refuse stale publish/suspend/archive operations if another review changed it. Resolve a stale correction with maintain/reject and edit the current establishment separately if appropriate.
- `maintain` is not re-verification: it does not renew source validity. `publish` requires a new complete validated place and direct, confirmed, unit-scoped source for any directional position or customer statement.
- Expiry is evaluated on every read, not dependent on cron. Expired/suspended labels become unknown and all source/statement fields become null. Archived records disappear from list/map/detail/favorites. Review timestamps remain for explaining the stale state.
- List pages are 50, sorted accent-insensitively by name and UUID. Counts and filters use the same projection as the map. More than 200 matches are aggregated into at most 20×10 deterministic geographic cells; cluster counts sum to the entire result set. Map/list never silently truncate. Offset pagination is stable for an unchanged dataset; concurrent catalogue edits may shift offsets (the contract does not provide snapshot cursors).
- Accent folding covers Portuguese/Latin accented characters without extensions. It is not a full Unicode linguistic collation.
- Queue/audit are complete arrays per contract, not silently capped. Large deployments will need an explicit paginated admin contract before payloads grow beyond serverless response budgets.
- Similar name + address is flagged as `possible_duplicates` in suggestion queue entries; no auto-merge.

## Verification commands

Unit/security tests (no packages/services):

```sh
node --test tests/backend.test.mjs
```

Native PostgreSQL assertions, only on an empty isolated database after migration:

```sh
# Inject PG* variables securely. Do not put credentials on the command line.
PGDATABASE=bussola_qa psql -X -v ON_ERROR_STOP=1 -f tests/backend.sql
```

The script refuses non-QA database names, uses one transaction, covers publication, stale revisions, idempotency, grants/RLS, sources, real-clock expiry, rate retention, 251-point clustering and complete pagination, then rolls back every fixture.

Real concurrent native PostgreSQL test (two independent psql sessions):

```sh
PGDATABASE=bussola_qa BUSSOLA_RUN_DB_CONCURRENCY=1 node --test tests/backend-concurrency.mjs
```

This opt-in test temporarily writes isolated QA fixtures and removes exactly its own generated rows in `finally`. It is skipped by default. Both environment name and the actual database name must match `bussola_qa`/`bussola_test` (optional `_suffix`). It verifies exactly one idempotent row and exactly one audit/publication despite simultaneous requests. `PSQL_BINARY` may point to an installed psql executable.

Optional local PostgreSQL-WASM + real loopback HTTP test:

```sh
# Independently install @electric-sql/pglite outside the project first.
BUSSOLA_TEST_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js \
  node --test tests/backend.test.mjs tests/backend-postgres.mjs tests/backend-concurrency.mjs
```

This uses a fresh in-memory PostgreSQL engine, applies the actual migration, executes SQL invariants, and exercises the real Node handler over loopback HTTP against that engine. It does **not** claim native multi-session concurrency, remote HTTPS/PostgREST routing, Vercel integration or production deployment. The optional module is a test-only dependency; production never imports it.

No HTTP/environment switch can bypass production authentication or replace the database. Dependency injection is available only to in-process code imports in tests. QA fixture scripts are never application routes.
