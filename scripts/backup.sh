#!/usr/bin/env bash
# Logical backup of the Supabase Postgres database (schema + data) to ./backups, plus a storage export.
# Requires: pg_dump (PostgreSQL client 15+), and DATABASE_URL in the ENVIRONMENT (never committed):
#   Supabase dashboard -> Connect -> Session pooler connection string (contains the DB password).
#   Example:  DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres' bash scripts/backup.sh
# The backup contains personal data and payment evidence references: it is written with mode 600 into a git-ignored folder.
# Store a copy off the machine (encrypted) and test a restore (see docs/BACKUP_RESTORE.md).
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL (Supabase session-pooler connection string) in the environment}"
cd "$(dirname "$0")/.."
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p backups
out="backups/influencia-db-$stamp.dump"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --schema=public --schema=auth --file="$out"
echo "database dump: $out ($(du -h "$out" | cut -f1))"
if [ -f .env.local ]; then node --env-file=.env.local scripts/export-storage.mjs "backups/storage-$stamp"; else echo "skipped storage export (no .env.local)"; fi
echo "done. Copy backups/ somewhere safe and encrypted; never commit it."
