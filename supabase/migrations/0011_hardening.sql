-- 0011_hardening: addresses Supabase security advisors.
alter function set_updated_at() set search_path = public;
alter function enforce_capacity() set search_path = public;
alter function forbid_mutation() set search_path = public;
alter function log_payment_event(uuid,text,payment_status,payment_status,numeric,uuid,jsonb) set search_path = public;

-- RLS helper functions live in a schema that PostgREST does not expose, so they cannot be called via /rest/v1/rpc.
-- Policies keep working: they reference the functions by OID and the roles keep EXECUTE + schema USAGE.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;
alter function has_permission(text) set schema private;
alter function is_admin() set schema private;
