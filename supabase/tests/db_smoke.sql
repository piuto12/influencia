-- Run against a scratch DB after migrations. Prints PASS/FAIL lines.
\set ON_ERROR_STOP off
update event_editions set capacity = 1 where code='INF3';
set role service_role;
select 'PASS register' where (select reference from register_for_edition('INF3',
  '{"full_name":"Test One","email":"a@example.test","mobile":"9000000001","category":"student"}')) like 'INF3-%';
select 'PASS duplicate blocked' where not exists (select 1) and false;
do $$ begin
  perform register_for_edition('INF3','{"full_name":"Test One","email":"A@example.test","mobile":"9000000001","category":"student"}');
  raise notice 'FAIL duplicate not blocked';
exception when others then raise notice 'PASS duplicate blocked: %', sqlerrm; end $$;
do $$ begin
  perform register_for_edition('INF3','{"full_name":"Bad Cat","email":"c@example.test","mobile":"9","category":"nope"}');
  raise notice 'FAIL bad category accepted';
exception when others then raise notice 'PASS invalid category rejected'; end $$;
select register_for_edition('INF3','{"full_name":"Test Two","email":"b@example.test","mobile":"9000000002","category":"manager_leader"}') \gset
reset role;
select 'PASS pending not counted' where (select count(*) from registrations where status='confirmed')=0;
set role service_role;
do $$ declare r record; begin
  select id into r from registrations where participant_id=(select id from participants where email='a@example.test');
  raise notice 'first confirm -> %', confirm_registration(r.id, null);
  select id into r from registrations where participant_id=(select id from participants where email='b@example.test');
  begin perform confirm_registration(r.id, null); raise notice 'FAIL overbooked';
  exception when others then raise notice 'PASS capacity enforced: %', sqlerrm; end;
  begin update registrations set status='confirmed' where id=r.id; raise notice 'FAIL trigger bypass';
  exception when others then raise notice 'PASS trigger blocks direct update: %', sqlerrm; end;
end $$;
-- deadline
reset role;
update event_editions set registration_deadline = now() - interval '1 day';
set role service_role;
do $$ begin
  perform register_for_edition('INF3','{"full_name":"Late","email":"l@example.test","mobile":"9","category":"student"}');
  raise notice 'FAIL deadline ignored';
exception when others then raise notice 'PASS deadline enforced: %', sqlerrm; end $$;
-- anonymous access
set role anon;
do $$ begin perform 1 from participants limit 1; raise notice 'FAIL anon read participants'; exception when insufficient_privilege then raise notice 'PASS anon denied participants'; end $$;
do $$ begin perform register_for_edition('INF3','{}'); raise notice 'FAIL anon can call register'; exception when others then raise notice 'PASS anon cannot call register_for_edition'; end $$;
do $$ begin insert into audit_logs(action) values('x'); raise notice 'FAIL anon insert'; exception when others then raise notice 'PASS anon cannot write audit'; end $$;
-- authenticated non-admin
reset role; set role authenticated;
select 'PASS authenticated non-admin sees 0 payments' where (select count(*) from payments)=0;
select 'PASS authenticated non-admin sees 0 registrations' where (select count(*) from registrations)=0;
