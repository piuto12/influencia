-- 0010_admin_functions: registration status changes that are not seat confirmations.
create or replace function set_registration_status(p_registration uuid, p_status registration_status, p_actor uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare reg registrations;
begin
  if p_status not in ('rejected','cancelled','waitlisted') then raise exception 'invalid_status' using errcode='P0001'; end if;
  select * into reg from registrations where id = p_registration for update;
  if not found then raise exception 'registration_not_found' using errcode='P0001'; end if;
  if reg.status = p_status then return; end if;
  if p_status in ('rejected','cancelled') and (p_note is null or length(trim(p_note)) < 3) then
    raise exception 'reason_required' using errcode='P0001'; end if;
  update registrations set status = p_status, confirmed_at = case when reg.status='confirmed' then null else confirmed_at end,
    waitlist_position = case when p_status='waitlisted'
      then coalesce((select max(waitlist_position) from registrations where edition_id = reg.edition_id),0)+1 else null end
  where id = reg.id;
  insert into registration_history (registration_id, from_status, to_status, actor_id, note)
  values (reg.id, reg.status, p_status, p_actor, p_note);
end $$;
revoke all on function set_registration_status(uuid, registration_status, uuid, text) from public, anon, authenticated;
grant execute on function set_registration_status(uuid, registration_status, uuid, text) to service_role;
