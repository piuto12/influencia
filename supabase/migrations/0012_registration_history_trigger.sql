-- 0012: every registration status change is logged, whichever function made it.
-- Functions pass the acting admin/note via transaction-local settings (app.actor / app.note).
create or replace function log_registration_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into registration_history (registration_id, from_status, to_status, actor_id, note)
  values (new.id, old.status, new.status,
          nullif(current_setting('app.actor', true), '')::uuid, nullif(current_setting('app.note', true), ''));
  return new;
end $$;
create trigger t_reg_history after update of status on registrations
  for each row when (old.status is distinct from new.status) execute function log_registration_status();

create or replace function confirm_registration(p_registration uuid, p_actor uuid)
returns registration_status
language plpgsql security definer set search_path = public as $$
declare reg registrations; ed event_editions; taken int; result registration_status;
begin
  perform set_config('app.actor', coalesce(p_actor::text, ''), true);
  perform set_config('app.note', '', true);
  select * into reg from registrations where id = p_registration for update;
  if not found then raise exception 'registration_not_found' using errcode = 'P0001'; end if;
  if reg.status = 'confirmed' then return 'confirmed'; end if;
  if reg.status in ('rejected','cancelled') then
    raise exception 'invalid_state' using errcode = 'P0001'; end if;
  select * into ed from event_editions where id = reg.edition_id for update;
  select count(*) into taken from registrations where edition_id = ed.id and status = 'confirmed';
  if taken < ed.capacity then
    update registrations set status='confirmed', confirmed_at=now(), waitlist_position=null where id = reg.id;
    result := 'confirmed';
  elsif ed.waitlist_enabled then
    update registrations set status='waitlisted',
      waitlist_position = coalesce((select max(waitlist_position) from registrations
                                    where edition_id = ed.id), 0) + 1 where id = reg.id;
    result := 'waitlisted';
  else
    raise exception 'capacity_reached' using errcode = 'P0001';
  end if;
  return result;
end $$;

create or replace function set_registration_status(p_registration uuid, p_status registration_status, p_actor uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare reg registrations;
begin
  if p_status not in ('rejected','cancelled','waitlisted') then raise exception 'invalid_status' using errcode='P0001'; end if;
  perform set_config('app.actor', coalesce(p_actor::text, ''), true);
  perform set_config('app.note', coalesce(p_note, ''), true);
  select * into reg from registrations where id = p_registration for update;
  if not found then raise exception 'registration_not_found' using errcode='P0001'; end if;
  if reg.status = p_status then return; end if;
  if p_status in ('rejected','cancelled') and (p_note is null or length(trim(p_note)) < 3) then
    raise exception 'reason_required' using errcode='P0001'; end if;
  update registrations set status = p_status, confirmed_at = case when reg.status='confirmed' then null else confirmed_at end,
    waitlist_position = case when p_status='waitlisted'
      then coalesce((select max(waitlist_position) from registrations where edition_id = reg.edition_id),0)+1 else null end
  where id = reg.id;
end $$;

-- Payment functions: record the acting admin before touching the registration row.
create or replace function start_payment_review(p_payment uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  perform set_config('app.actor', coalesce(p_actor::text, ''), true); perform set_config('app.note', 'payment review started', true);
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
  perform set_config('app.actor', coalesce(p_actor::text, ''), true); perform set_config('app.note', 'payment verified', true);
  select * into p from payments where id=p_payment for update;
  if not found then raise exception 'payment_not_found' using errcode='P0001'; end if;
  if p.status = 'verified' then return; end if;
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
  perform set_config('app.actor', coalesce(p_actor::text, ''), true); perform set_config('app.note', 'payment rejected: ' || p_reason, true);
  select * into p from payments where id=p_payment for update;
  if not found then raise exception 'payment_not_found' using errcode='P0001'; end if;
  if p.status not in ('proof_submitted','under_verification') then raise exception 'invalid_state' using errcode='P0001'; end if;
  update payments set status='rejected', rejection_reason=p_reason where id=p.id;
  update registrations set status='payment_pending' where id=p.registration_id and status in ('proof_submitted','under_verification');
  perform log_payment_event(p.id,'rejected',p.status,'rejected',p.amount,p_actor,jsonb_build_object('reason',p_reason));
end $$;

-- Customer-side steps have no admin actor: clear any stale setting so history shows a null actor.
create or replace function submit_payment_proof(p_payment uuid, p_txn_ref text, p_path text, p_mime text, p_size int)
returns void language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  perform set_config('app.actor', '', true); perform set_config('app.note', 'payment details submitted', true);
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

create or replace function apply_gateway_payment(p_order text, p_gateway_payment text, p_amount numeric, p_source text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  perform set_config('app.actor', '', true); perform set_config('app.note', 'gateway payment verified (' || p_source || ')', true);
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
