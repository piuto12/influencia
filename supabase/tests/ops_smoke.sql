-- Run after migrations + seed on a scratch DB.
\set ON_ERROR_STOP off
update event_editions set capacity = 5 where code='INF3';
set role service_role;
select registration_id as rid from register_for_edition('INF3','{"full_name":"Ops Tester","email":"ops@example.test","mobile":"+919000000011","category":"student"}') \gset
do $$ begin perform check_in_registration((select id from registrations limit 1),'qr',null); raise notice 'FAIL checked in unconfirmed'; exception when others then raise notice 'PASS unconfirmed cannot check in: %', sqlerrm; end $$;
do $$ begin perform issue_certificate((select id from registrations limit 1),null,null); raise notice 'FAIL certificate for unconfirmed'; exception when others then raise notice 'PASS unconfirmed not eligible'; end $$;
select confirm_registration(:'rid', null);
do $$ begin perform issue_certificate((select id from registrations limit 1),null,null); raise notice 'FAIL certificate without attendance'; exception when others then raise notice 'PASS confirmed but not attended -> not eligible'; end $$;
select check_in_registration(:'rid','qr','00000000-0000-0000-0000-0000000000aa') ->> 'result' as first_scan;
select check_in_registration(:'rid','qr',null) ->> 'result' as second_scan;
select 'PASS single attendance row' where (select count(*) from attendance where registration_id=:'rid')=1;
select issue_certificate(:'rid', null, '00000000-0000-0000-0000-0000000000aa') as code \gset
select 'PASS code format' where :'code' ~ '^CERT-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$';
select 'PASS issue is idempotent' where issue_certificate(:'rid', null, null) = :'code';
select 'PASS one certificate row' where (select count(*) from certificates)=1;
do $$ begin perform revoke_certificate('CERT-AAAA-AAAA-AAAA-AAAA', null, 'x'); raise notice 'FAIL revoked short reason'; exception when others then raise notice 'PASS revoke needs reason: %', sqlerrm; end $$;
select revoke_certificate(:'code', '00000000-0000-0000-0000-0000000000aa', 'Issued in error');
select 'PASS revoked' where (select revoked_at is not null from certificates where certificate_code=:'code');
do $$ begin perform undo_check_in((select id from registrations limit 1), null, ' '); raise notice 'FAIL undo w/o reason'; exception when others then raise notice 'PASS undo needs reason'; end $$;
select undo_check_in(:'rid','00000000-0000-0000-0000-0000000000aa','Scanned wrong person');
select 'PASS undo removed row + audited' where (select count(*) from attendance)=0 and (select count(*) from audit_logs where action='attendance.undone')=1;
reset role; set role anon;
do $$ begin perform check_in_registration(gen_random_uuid(),'qr',null); raise notice 'FAIL anon check-in'; exception when others then raise notice 'PASS anon cannot check in'; end $$;
reset role; set role authenticated;
do $$ begin perform issue_certificate(gen_random_uuid(),null,null); raise notice 'FAIL authenticated issue'; exception when others then raise notice 'PASS authenticated cannot issue'; end $$;
