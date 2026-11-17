-- 0007_functions: registration + capacity (transaction-safe)
create or replace function gen_registration_reference(p_code text) returns text
language plpgsql set search_path = public, extensions as $$
declare alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; ref text := ''; b bytea; i int;
begin
  b := gen_random_bytes(6);
  for i in 0..5 loop ref := ref || substr(alphabet, (get_byte(b,i) % 31) + 1, 1); end loop;
  return p_code || '-' || ref;
end $$;

-- Second line of defence: no path may push confirmed seats above capacity.
create or replace function enforce_capacity() returns trigger
language plpgsql as $$
declare cap int; taken int;
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    select capacity into cap from event_editions where id = new.edition_id for update;
    select count(*) into taken from registrations
      where edition_id = new.edition_id and status = 'confirmed' and id <> new.id;
    if taken >= cap then raise exception 'capacity_reached' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
create trigger t_capacity before insert or update of status on registrations
  for each row execute function enforce_capacity();

-- Called only by the server (service role).
create or replace function register_for_edition(p_edition_code text, p_data jsonb)
returns table (registration_id uuid, reference text)
language plpgsql security definer set search_path = public as $$
declare ed event_editions; pid uuid; rid uuid; ref text; tries int := 0;
begin
  select * into ed from event_editions where code = p_edition_code;
  if not found then raise exception 'edition_not_found' using errcode = 'P0001'; end if;
  if not ed.registration_open or ed.status in ('draft','completed','archived') then
    raise exception 'registration_closed' using errcode = 'P0001'; end if;
  if ed.registration_deadline is not null and now() > ed.registration_deadline then
    raise exception 'deadline_passed' using errcode = 'P0001'; end if;

  insert into participants (full_name,email,mobile,whatsapp,organization,designation,department,city)
  values (p_data->>'full_name', p_data->>'email', p_data->>'mobile', p_data->>'whatsapp',
          p_data->>'organization', p_data->>'designation', p_data->>'department', p_data->>'city')
  on conflict (email) do update set
    full_name = excluded.full_name, mobile = excluded.mobile, whatsapp = excluded.whatsapp,
    organization = excluded.organization, designation = excluded.designation,
    department = excluded.department, city = excluded.city
  returning id into pid;

  if exists (select 1 from registrations r where r.edition_id = ed.id and r.participant_id = pid) then
    raise exception 'duplicate_registration' using errcode = 'P0001'; end if;

  loop
    ref := gen_registration_reference(ed.code);
    begin
      insert into registrations (edition_id,participant_id,reference,category,previous_participation,
                                 consent_at,status,details_snapshot)
      values (ed.id, pid, ref, (p_data->>'category')::participant_category,
              coalesce((p_data->>'previous_participation')::boolean,false), now(),
              'payment_pending', p_data)
      returning id into rid;
      exit;
    exception when unique_violation then
      if exists (select 1 from registrations r where r.edition_id = ed.id and r.participant_id = pid) then
        raise exception 'duplicate_registration' using errcode = 'P0001'; end if;
      tries := tries + 1; if tries > 5 then raise; end if;   -- reference collision: retry
    end;
  end loop;

  insert into registration_history (registration_id, from_status, to_status, note)
  values (rid, null, 'payment_pending', 'registered');
  return query select rid, ref;
end $$;

-- Admin approval. Locks the edition row so concurrent approvals cannot overbook.
create or replace function confirm_registration(p_registration uuid, p_actor uuid)
returns registration_status
language plpgsql security definer set search_path = public as $$
declare reg registrations; ed event_editions; taken int; result registration_status;
begin
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
  insert into registration_history (registration_id, from_status, to_status, actor_id)
  values (reg.id, reg.status, result, p_actor);
  return result;
end $$;

revoke all on function register_for_edition(text, jsonb) from public, anon, authenticated;
revoke all on function confirm_registration(uuid, uuid) from public, anon, authenticated;
grant execute on function register_for_edition(text, jsonb) to service_role;
grant execute on function confirm_registration(uuid, uuid) to service_role;
