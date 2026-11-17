-- 0009_payment_functions: payment state machine. All functions are service-role only; the server
-- performs authorization first. The ledger (payment_events) is immutable even for the service role.

create or replace function forbid_mutation() returns trigger language plpgsql as $$
begin raise exception 'immutable_table' using errcode = 'P0001'; end $$;
create trigger payment_events_immutable before update or delete on payment_events
  for each row execute function forbid_mutation();
create trigger audit_logs_immutable before update or delete on audit_logs
  for each row execute function forbid_mutation();
create trigger registration_history_immutable before update or delete on registration_history
  for each row execute function forbid_mutation();

-- One live payment per registration.
create unique index payments_one_live on payments (registration_id)
  where status in ('pending','proof_submitted','under_verification','verified');

create or replace function log_payment_event(p_payment uuid, p_type text, p_from payment_status, p_to payment_status,
  p_amount numeric, p_actor uuid, p_data jsonb) returns void language sql as $$
  insert into payment_events (payment_id,event_type,from_status,to_status,amount,actor_id,data)
  values (p_payment,p_type,p_from,p_to,p_amount,p_actor,coalesce(p_data,'{}'));
$$;

-- Create (or replace a still-pending) payment, snapshotting the fee and settings version.
create or replace function create_payment(p_registration uuid, p_method text, p_fee numeric, p_discount jsonb default '[]')
returns uuid language plpgsql security definer set search_path = public as $$
declare reg registrations; s payment_settings; old payments; pid uuid; final_amount numeric;
begin
  select * into reg from registrations where id = p_registration for update;
  if not found then raise exception 'registration_not_found' using errcode='P0001'; end if;
  if reg.status in ('confirmed','rejected','cancelled') then raise exception 'invalid_state' using errcode='P0001'; end if;
  select * into s from payment_settings where edition_id = reg.edition_id and method_code = p_method and enabled;
  if not found then raise exception 'method_unavailable' using errcode='P0001'; end if;
  if s.deadline is not null and now() > s.deadline then raise exception 'payment_deadline_passed' using errcode='P0001'; end if;
  -- amount is recomputed from the stored settings; p_fee (client-side computed discount result) must match or be lower-bounded
  final_amount := greatest(0, p_fee);
  if final_amount > s.fee_amount then raise exception 'invalid_amount' using errcode='P0001'; end if;

  select * into old from payments where registration_id = reg.id
    and status in ('pending','proof_submitted','under_verification','verified') for update;
  if found then
    if old.status <> 'pending' then raise exception 'payment_in_progress' using errcode='P0001'; end if;
    update payments set status='failed' where id = old.id;
    perform log_payment_event(old.id,'superseded','pending','failed',old.amount,null,jsonb_build_object('new_method',p_method));
  end if;

  insert into payments (registration_id,method_code,status,amount,currency,fee_snapshot,settings_version)
  values (reg.id,p_method,'pending',final_amount,s.currency,
          jsonb_build_object('base_fee',s.fee_amount,'discounts',p_discount,'final',final_amount,'currency',s.currency,'settings_version',s.version),
          s.version)
  returning id into pid;
  perform log_payment_event(pid,'created',null,'pending',final_amount,null,jsonb_build_object('method',p_method));
  if reg.status = 'submitted' then
    update registrations set status='payment_pending' where id = reg.id;
  end if;
  return pid;
end $$;

create or replace function submit_payment_proof(p_payment uuid, p_txn_ref text, p_path text, p_mime text, p_size int)
returns void language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  select * into p from payments where id = p_payment for update;
  if not found then raise exception 'payment_not_found' using errcode='P0001'; end if;
  if p.status not in ('pending','rejected') then raise exception 'invalid_state' using errcode='P0001'; end if;
  if p_path is not null then
    insert into payment_proofs (payment_id,storage_path,mime,size_bytes) values (p.id,p_path,p_mime,p_size);
  end if;
  update payments set status='proof_submitted', transaction_ref=coalesce(p_txn_ref,transaction_ref), rejection_reason=null where id=p.id;
  update registrations set status='proof_submitted' where id=p.registration_id and status in ('payment_pending','submitted','proof_submitted');
  perform log_payment_event(p.id,'proof_submitted',p.status,'proof_submitted',p.amount,null,jsonb_build_object('txn_ref',p_txn_ref,'proof',p_path is not null));
end $$;
-- note: 'rejected' payments may be resubmitted; unique-live index excludes rejected so create_payment can also start fresh.

create or replace function start_payment_review(p_payment uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  select * into p from payments where id=p_payment for update;
  if not found then raise exception 'payment_not_found' using errcode='P0001'; end if;
  if p.status = 'under_verification' then return; end if;
  if p.status <> 'proof_submitted' then raise exception 'invalid_state' using errcode='P0001'; end if;
  update payments set status='under_verification' where id=p.id;
  update registrations set status='under_verification' where id=p.registration_id and status in ('proof_submitted','payment_pending');
  perform log_payment_event(p.id,'review_started','proof_submitted','under_verification',p.amount,p_actor,null);
end $$;

create or replace function verify_payment(p_payment uuid, p_actor uuid, p_txn_ref text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  select * into p from payments where id=p_payment for update;
  if not found then raise exception 'payment_not_found' using errcode='P0001'; end if;
  if p.status = 'verified' then return; end if;   -- idempotent
  if p.status not in ('proof_submitted','under_verification','pending') then raise exception 'invalid_state' using errcode='P0001'; end if;
  update payments set status='verified', verified_by=p_actor, verified_at=now(), rejection_reason=null,
         transaction_ref=coalesce(p_txn_ref,transaction_ref) where id=p.id;
  update registrations set status='under_verification' where id=p.registration_id and status in ('payment_pending','proof_submitted');
  perform log_payment_event(p.id,'verified',p.status,'verified',p.amount,p_actor,jsonb_build_object('txn_ref',p_txn_ref));
end $$;

create or replace function reject_payment(p_payment uuid, p_actor uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'reason_required' using errcode='P0001'; end if;
  select * into p from payments where id=p_payment for update;
  if not found then raise exception 'payment_not_found' using errcode='P0001'; end if;
  if p.status not in ('proof_submitted','under_verification') then raise exception 'invalid_state' using errcode='P0001'; end if;
  update payments set status='rejected', rejection_reason=p_reason where id=p.id;
  update registrations set status='payment_pending' where id=p.registration_id and status in ('proof_submitted','under_verification');
  perform log_payment_event(p.id,'rejected',p.status,'rejected',p.amount,p_actor,jsonb_build_object('reason',p_reason));
end $$;

create or replace function record_refund(p_payment uuid, p_amount numeric, p_reason text, p_actor uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare p payments; refunded numeric; rid uuid; new_status payment_status;
begin
  select * into p from payments where id=p_payment for update;
  if not found then raise exception 'payment_not_found' using errcode='P0001'; end if;
  if p.status not in ('verified','partially_refunded') then raise exception 'invalid_state' using errcode='P0001'; end if;
  select coalesce(sum(amount),0) into refunded from refunds where payment_id=p.id;
  if p_amount <= 0 or refunded + p_amount > p.amount then raise exception 'invalid_amount' using errcode='P0001'; end if;
  insert into refunds (payment_id,amount,reason,recorded_by) values (p.id,p_amount,p_reason,p_actor) returning id into rid;
  new_status := case when refunded + p_amount = p.amount then 'refunded' else 'partially_refunded' end;
  update payments set status=new_status where id=p.id;
  perform log_payment_event(p.id,'refund_recorded',p.status,new_status,p_amount,p_actor,jsonb_build_object('reason',p_reason));
  return rid;
end $$;

-- Gateway (Razorpay) confirmation: called only after server-side signature verification. Idempotent.
create or replace function apply_gateway_payment(p_order text, p_gateway_payment text, p_amount numeric, p_source text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  select * into p from payments where gateway_order_id = p_order for update;
  if not found then raise exception 'payment_not_found' using errcode='P0001'; end if;
  if p.status = 'verified' then return p.id; end if;
  if p.status not in ('pending','failed','proof_submitted','under_verification') then raise exception 'invalid_state' using errcode='P0001'; end if;
  if p_amount is not null and p_amount <> p.amount then raise exception 'amount_mismatch' using errcode='P0001'; end if;
  update payments set status='verified', gateway_payment_id=p_gateway_payment, verified_at=now(), transaction_ref=p_gateway_payment where id=p.id;
  update registrations set status='under_verification' where id=p.registration_id and status in ('payment_pending','proof_submitted','submitted');
  perform log_payment_event(p.id,'gateway_verified',p.status,'verified',p.amount,null,jsonb_build_object('source',p_source,'gateway_payment_id',p_gateway_payment));
  return p.id;
end $$;

create or replace function set_gateway_order(p_payment uuid, p_order text)
returns void language sql security definer set search_path = public as $$
  update payments set gateway_order_id = p_order where id = p_payment and status = 'pending';
$$;

do $$ declare f text; begin
  foreach f in array array[
    'create_payment(uuid,text,numeric,jsonb)','submit_payment_proof(uuid,text,text,text,int)',
    'start_payment_review(uuid,uuid)','verify_payment(uuid,uuid,text)','reject_payment(uuid,uuid,text)',
    'record_refund(uuid,numeric,text,uuid)','apply_gateway_payment(text,text,numeric,text)','set_gateway_order(uuid,text)',
    'log_payment_event(uuid,text,payment_status,payment_status,numeric,uuid,jsonb)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- Private bucket for payment evidence (skipped where the storage schema is absent). No policies = no direct access;
-- the server uploads/reads with the service role and hands out short-lived signed URLs.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('private-payment-proofs','private-payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;
