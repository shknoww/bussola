#!/bin/sh
set -eu
umask 077
DIR=/home/marcos/services/bussola/backups
mkdir -p "$DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="$DIR/bussola-$STAMP.dump"
docker exec supabase-db pg_dump -U postgres -d postgres -n bussola -Fc > "$FILE.part"
test -s "$FILE.part"
mv "$FILE.part" "$FILE"
# A failed dump does not replace a good one. Keep 30 days.
python3 - "$DIR" <<'PY'
import pathlib,time,sys
for p in pathlib.Path(sys.argv[1]).glob('bussola-*.dump'):
    if p.stat().st_mtime < time.time()-30*86400: p.unlink()
PY
printf 'Bussola backup complete: %s\n' "$STAMP"
