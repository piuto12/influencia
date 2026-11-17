-- 0002_registration: participants, registrations, history
create type participant_category as enum
  ('entrepreneur','corporate_professional','college_faculty','student','business_owner','manager_leader','general_public');
create type registration_status as enum
  ('submitted','payment_pending','proof_submitted','under_verification','confirmed','rejected','cancelled','waitlisted');

create table participants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email citext not null unique,
  mobile text not null,
  whatsapp text,
  organization text,
  designation text,
  department text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index participants_mobile_idx on participants (mobile);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references event_editions(id) on delete restrict,
  participant_id uuid not null references participants(id) on delete restrict,
  reference text not null unique,
  category participant_category not null,
  previous_participation boolean not null default false,
  consent_at timestamptz not null,
  status registration_status not null default 'submitted',
  waitlist_position int,
  confirmed_at timestamptz,
  details_snapshot jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, participant_id)
);
create index registrations_confirmed_idx on registrations (edition_id) where status = 'confirmed';
create index registrations_status_idx on registrations (edition_id, status);

create table registration_history (
  id bigint generated always as identity primary key,
  registration_id uuid not null references registrations(id) on delete restrict,
  from_status registration_status,
  to_status registration_status not null,
  actor_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index reg_hist_idx on registration_history (registration_id);

create trigger t_upd before update on participants for each row execute function set_updated_at();
create trigger t_upd before update on registrations for each row execute function set_updated_at();
