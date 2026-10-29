-- Optional hourly maintenance executed by the operator as the schema owner.
-- Never schedule this by changing an existing server's cron configuration implicitly.
-- Only Bússola salted rate-limit buckets are deleted; no contributions/audit/other schemas.
BEGIN;
DELETE FROM bussola.rate_limits WHERE expires_at <= statement_timestamp();
COMMIT;
