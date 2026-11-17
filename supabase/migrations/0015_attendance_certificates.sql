-- 0015: attendance check-in, corrections, certificates (all service-role only).
alter table event_editions alter column attendance_rule set default '{"require_check_in":true}';
update event_editions set attendance_rule = '{"require_check_in":true}' where attendance_rule ? 'min_percent';
alter table certificates add column if not exists revoked_reason text;

-- Idempotent: a second scan never creates a second row.
create or replace function check_in_registration(p_registration uuid, p_method text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare reg registrations; att attendance;
begin
  if p_method not in ('qr','manual') then raise exception 'invalid_method' using errcode='P0001'; end if;
  select * into reg from registrations where id = p_registration for update;
  if not found then raise exception 'registration_not_found' using errcode='P0001'; end if;
  if reg.status <> 'confirmed' then raise exception 'not_confirmed' using errcode='P0001'; end if;
  select * into att from attendance where registration_id = reg.id;
  if found then return jsonb_build_object('result','already_checked_in','at',att.checked_in_at); end if;
  insert into attendance (registration_id, method, checked_in_by) values (reg.id, p_method, p_actor) returning * into att;
  return jsonb_build_object('result','checked_in','at',att.checked_in_at);
end $$;

-- Correction: removes a check-in; the reason and the removed row are written to the audit log in the same transaction.
create or replace function undo_check_in(p_registration uuid, p_actor uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare att attendance;
begin
  if p_note is null or length(trim(p_note)) < 3 then raise exception 'reason_required' using errcode='P0001'; end if;
  select * into att from attendance where registration_id = p_registration for update;
  if not found then raise exception 'not_checked_in' using errcode='P0001'; end if;
  insert into audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_actor, 'attendance.undone', 'registration', p_registration::text, to_jsonb(att), jsonb_build_object('note', p_note));
  delete from attendance where id = att.id;
end $$;

create or replace function gen_certificate_code() returns text
language plpgsql set search_path = public, extensions as $$
declare alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; code text := 'CERT'; b bytea; i int;
begin
  b := gen_random_bytes(16);
  for i in 0..15 loop
    if i % 4 = 0 then code := code || '-'; end if;
    code := code || substr(alphabet, (get_byte(b,i) % 31) + 1, 1);
  end loop;
  return code;   -- 16 symbols from a 31-letter alphabet ≈ 79 bits
end $$;

-- Issues (or returns) the certificate if the organizer's attendance rule is met. Idempotent.
create or replace function issue_certificate(p_registration uuid, p_template uuid, p_actor uuid)
returns text language plpgsql security definer set search_path = public as $$
declare reg registrations; ed event_editions; code text; existing text; need boolean; tries int := 0;
begin
  select * into reg from registrations where id = p_registration for update;
  if not found then raise exception 'registration_not_found' using errcode='P0001'; end if;
  if reg.status <> 'confirmed' then raise exception 'not_eligible' using errcode='P0001'; end if;
  select * into ed from event_editions where id = reg.edition_id;
  need := coalesce((ed.attendance_rule->>'require_check_in')::boolean, true);
  if need and not exists (select 1 from attendance where registration_id = reg.id) then
    raise exception 'not_eligible' using errcode='P0001'; end if;
  select certificate_code into existing from certificates where registration_id = reg.id;
  if existing is not null then return existing; end if;
  loop
    code := gen_certificate_code();
    begin
      insert into certificates (registration_id, template_id, certificate_code) values (reg.id, p_template, code);
      exit;
    exception when unique_violation then
      select certificate_code into existing from certificates where registration_id = reg.id;
      if existing is not null then return existing; end if;
      tries := tries + 1; if tries > 5 then raise; end if;
    end;
  end loop;
  insert into audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_actor, 'certificate.issued', 'registration', reg.id::text, jsonb_build_object('code', code));
  return code;
end $$;

create or replace function revoke_certificate(p_code text, p_actor uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'reason_required' using errcode='P0001'; end if;
  update certificates set revoked_at = now(), revoked_reason = p_reason where certificate_code = p_code and revoked_at is null;
  if not found then raise exception 'not_found' using errcode='P0001'; end if;
  insert into audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_actor, 'certificate.revoked', 'certificate', p_code, jsonb_build_object('reason', p_reason));
end $$;

do $$ declare f text; begin
  foreach f in array array['check_in_registration(uuid,text,uuid)','undo_check_in(uuid,uuid,text)','gen_certificate_code()',
    'issue_certificate(uuid,uuid,uuid)','revoke_certificate(text,uuid,text)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
