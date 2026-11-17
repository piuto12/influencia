-- Structural RLS checks: every public table has RLS on; anon/authenticated hold no dangerous grants.
\set ON_ERROR_STOP off
select case when count(*) = 0 then 'PASS every public table has RLS enabled' else 'FAIL tables without RLS: ' || string_agg(tablename, ',') end
  from pg_tables where schemaname='public' and not rowsecurity;
select case when count(*) = 0 then 'PASS no FOR ALL admin policies left' else 'FAIL ' || count(*) || ' FOR ALL policies' end
  from pg_policies where schemaname='public' and cmd='ALL';
select case when count(*) = 0 then 'PASS anon has no privileges on sensitive tables' else 'FAIL anon can touch: ' || string_agg(table_name, ',') end
  from information_schema.role_table_grants where grantee='anon' and table_schema='public'
   and table_name in ('participants','registrations','registration_history','payments','payment_events','payment_proofs','payment_webhooks','payment_settings','refunds','admin_users','roles','permissions','role_permissions','audit_logs','attendance','certificates','certificate_templates','notifications','notification_templates','rate_limits');
select case when count(*) = 0 then 'PASS anon cannot write any table' else 'FAIL anon write grants: ' || string_agg(distinct table_name, ',') end
  from information_schema.role_table_grants where grantee='anon' and table_schema='public' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
select case when count(*) = 0 then 'PASS no API-executable SECURITY DEFINER function for anon/authenticated (except none)' else 'FAIL exposed definer functions: ' || string_agg(p.proname, ',') end
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
select case when count(*) = 0 then 'PASS append-only tables reject UPDATE/DELETE for authenticated' else 'FAIL mutable ledger grants: ' || string_agg(table_name, ',') end
  from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and privilege_type in ('UPDATE','DELETE')
   and table_name in ('audit_logs','payment_events','registration_history','payment_webhooks');
select case when not has_column_privilege('anon','event_editions','whatsapp_group_url','select')
             and not has_column_privilege('authenticated','event_editions','whatsapp_group_url','select')
             and has_column_privilege('anon','event_editions','title','select')
            then 'PASS WhatsApp group link is not readable through the public API (public columns still are)'
            else 'FAIL whatsapp_group_url exposure' end;
