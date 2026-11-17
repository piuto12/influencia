-- Run after migrations + seed on a scratch DB.
\set ON_ERROR_STOP off
update event_editions set capacity = 5 where code='INF3';
update payment_settings set enabled=true, fee_amount=1000, config='{"upi_id":"test@upi"}'
 where method_code='upi' and edition_id=(select id from event_editions where code='INF3');
update payment_settings set enabled=false, fee_amount=1000
 where method_code='bank_transfer' and edition_id=(select id from event_editions where code='INF3');
set role service_role;
select registration_id as rid from register_for_edition('INF3','{"full_name":"Pay Tester","email":"pay@example.test","mobile":"+919000000001","category":"student"}') \gset
select create_payment(:'rid','upi',1000) as pid \gset
do $$ begin perform create_payment((select id from registrations limit 1),'bank_transfer',1000); raise notice 'FAIL disabled method allowed';
  exception when others then raise notice 'PASS disabled method rejected: %', sqlerrm; end $$;
do $$ begin perform create_payment((select id from registrations limit 1),'upi',5000); raise notice 'FAIL inflated amount';
  exception when others then raise notice 'PASS inflated amount rejected: %', sqlerrm; end $$;
select 'PASS fee snapshot' where (select fee_snapshot->>'base_fee' from payments where id=:'pid')='1000.00' or (select (fee_snapshot->>'base_fee')::numeric from payments where id=:'pid')=1000;
select submit_payment_proof(:'pid','UTR123','proofs/a.png','image/png',1234);
select 'PASS proof -> statuses' where (select status from payments where id=:'pid')='proof_submitted' and (select status from registrations where id=:'rid')='proof_submitted';
do $$ begin perform create_payment((select id from registrations limit 1),'upi',1000); raise notice 'FAIL replaced non-pending';
  exception when others then raise notice 'PASS cannot replace in-progress payment: %', sqlerrm; end $$;
do $$ begin perform reject_payment((select id from payments limit 1), null, ' '); raise notice 'FAIL reject w/o reason';
  exception when others then raise notice 'PASS reject needs reason'; end $$;
select reject_payment(:'pid', null, 'Amount does not match');
select 'PASS rejected -> reg back to payment_pending' where (select status from registrations where id=:'rid')='payment_pending' and (select status from payments where id=:'pid')='rejected';
select submit_payment_proof(:'pid','UTR124','proofs/b.png','image/png',99);
select start_payment_review(:'pid', null);
select verify_payment(:'pid', null);
select verify_payment(:'pid', null);  -- idempotent
select 'PASS verified, reg under_verification' where (select status from payments where id=:'pid')='verified' and (select status from registrations where id=:'rid')='under_verification';
select 'PASS single verified event' where (select count(*) from payment_events where payment_id=:'pid' and event_type='verified')=1;
select 'PASS admin approval after verification' where confirm_registration(:'rid', null)='confirmed';
do $$ begin perform record_refund((select id from payments limit 1), 2000, 'x', null); raise notice 'FAIL over-refund';
  exception when others then raise notice 'PASS over-refund rejected: %', sqlerrm; end $$;
select record_refund(:'pid', 400, 'partial', '00000000-0000-0000-0000-0000000000aa');
select 'PASS partially_refunded' where (select status from payments where id=:'pid')='partially_refunded';
select record_refund(:'pid', 600, 'rest', '00000000-0000-0000-0000-0000000000aa');
select 'PASS refunded' where (select status from payments where id=:'pid')='refunded';
do $$ begin update payment_events set event_type='x'; raise notice 'FAIL ledger mutable';
  exception when others then raise notice 'PASS ledger update blocked'; end $$;
do $$ begin delete from payment_events; raise notice 'FAIL ledger deletable';
  exception when others then raise notice 'PASS ledger delete blocked'; end $$;
-- historical fee preserved after settings change
reset role; update payment_settings set fee_amount=2500, version=2 where method_code='upi'; set role service_role;
select 'PASS historical fee preserved' where (select (fee_snapshot->>'base_fee')::numeric from payments where id=:'pid')=1000;
-- gateway idempotency
reset role; insert into payment_methods(code,label,provider) values ('razorpay_x','x','razorpay') on conflict do nothing; set role service_role;
select registration_id as rid2 from register_for_edition('INF3','{"full_name":"G Tester","email":"g@example.test","mobile":"+919000000002","category":"student"}') \gset
reset role; update payment_settings set fee_amount=1000 where method_code='upi'; set role service_role;
select create_payment(:'rid2','upi',1000) as pid2 \gset
select set_gateway_order(:'pid2','order_1');
select apply_gateway_payment('order_1','pay_1',1000,'webhook');
select apply_gateway_payment('order_1','pay_1',1000,'webhook');
select 'PASS gateway verified once' where (select count(*) from payment_events where payment_id=:'pid2' and event_type='gateway_verified')=1;
do $$ begin perform apply_gateway_payment('order_1','pay_1',999,'webhook'); raise notice 'PASS (already verified returns early)'; exception when others then raise notice 'info: %', sqlerrm; end $$;
reset role; set role anon;
do $$ begin perform verify_payment(gen_random_uuid(), null); raise notice 'FAIL anon verify'; exception when others then raise notice 'PASS anon cannot verify'; end $$;
reset role; set role authenticated;
do $$ begin perform verify_payment(gen_random_uuid(), null); raise notice 'FAIL authenticated verify'; exception when others then raise notice 'PASS authenticated cannot call verify directly'; end $$;
