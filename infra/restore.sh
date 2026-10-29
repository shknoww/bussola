#!/bin/sh
# Restore only into a NEW isolated database. Never target the live database.
set -eu
DB=${1:?Usage: restore.sh bussola_restore_NAME /absolute/backup.dump /absolute/001_bussola.sql}
DUMP=${2:?Missing backup}
MIGRATION=${3:?Missing migration}
case "$DB" in bussola_restore_*) ;; *) printf 'Refusing non-isolated database\n' >&2; exit 1;; esac
docker exec supabase-db createdb -U postgres "$DB"
# Full schema dump restores data before FK/triggers, including expired historical data.
docker exec -i supabase-db pg_restore -U postgres -d "$DB" --exit-on-error --single-transaction < "$DUMP"
# The public RPC lives outside the backed-up private schema. Restore from versioned migration.
python3 - "$MIGRATION" <<'PY' | docker exec -i supabase-db psql -X -U postgres -d "$DB" -v ON_ERROR_STOP=1
import pathlib,sys
s=pathlib.Path(sys.argv[1]).read_text()
start=s.index('CREATE FUNCTION public.bussola_gateway(')
print('BEGIN;\n'+s[start:])
PY
docker exec supabase-db psql -X -U postgres -d "$DB" -v ON_ERROR_STOP=1 -c "SELECT public.bussola_gateway('health'); SELECT count(*) AS orphaned_contributions FROM bussola.contributions c LEFT JOIN bussola.establishments e ON e.id=c.establishment_id WHERE c.establishment_id IS NOT NULL AND e.id IS NULL;"
