#!/usr/bin/env bash
# Runs every SQL suite in supabase/tests against a FRESH throwaway local Postgres database (Postgres.app / any local server).
# Creates stand-ins for Supabase's roles/auth schema, applies all migrations + seed, runs the suite, then drops everything it created.
# Usage: PATH=/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH bash supabase/tests/run.sh
set -u
cd "$(dirname "$0")/../.."
fail=0
for suite in db_smoke payments_smoke ops_smoke rls_matrix; do
  [ -f "supabase/tests/$suite.sql" ] || continue
  db="influencia_t_$suite"
  dropdb --if-exists "$db" >/dev/null 2>&1; createdb "$db" || exit 2
  psql -q -v ON_ERROR_STOP=1 -d "$db" >/dev/null <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth; create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
SQL
  for f in supabase/migrations/*.sql supabase/seed.sql; do
    psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$f" >/dev/null 2>/tmp/influencia_mig_err.txt || { echo "MIGRATION FAILED: $f"; cat /tmp/influencia_mig_err.txt; fail=1; }
  done
  out=$(psql -q -d "$db" -f "supabase/tests/$suite.sql" 2>&1)
  pass=$(echo "$out" | grep -c "PASS"); bad=$(echo "$out" | grep -c "FAIL")
  echo "[$suite] PASS=$pass FAIL=$bad"; [ "$bad" -gt 0 ] && { echo "$out" | grep "FAIL"; fail=1; }
  dropdb "$db" >/dev/null 2>&1
done
# remove the stand-in roles only if no database still depends on them
psql -qc "drop role if exists anon" -c "drop role if exists authenticated" -c "drop role if exists service_role" >/dev/null 2>&1
[ "$fail" -eq 0 ] && echo "ALL SQL SUITES PASSED" || { echo "SQL SUITES FAILED"; exit 1; }
