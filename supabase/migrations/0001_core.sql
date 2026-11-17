-- 0001_core: extensions, helpers, events, editions, settings
create extension if not exists pgcrypto;
create extension if not exists citext schema public;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create type edition_status as enum ('draft','upcoming','active','completed','archived');

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table event_editions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete restrict,
  edition_number int not null check (edition_number > 0),
  code text not null unique,                       -- e.g. INF3, used in references
  title text not null,
  subtitle text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'Asia/Kolkata',
  venue_name text,
  venue_city text,
  venue_address text,
  status edition_status not null default 'draft',
  is_featured boolean not null default false,
  capacity int not null default 200 check (capacity >= 0),
  waitlist_enabled boolean not null default false,
  registration_open boolean not null default false,
  registration_deadline timestamptz,
  attendance_rule jsonb not null default '{"min_percent":100}',
  cta_config jsonb not null default '{}',
  seo jsonb not null default '{}',
  whatsapp_group_url text,                         -- released only to confirmed participants
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, edition_number)
);
create unique index one_featured_edition on event_editions ((true)) where is_featured;
create trigger t_upd before update on events for each row execute function set_updated_at();
create trigger t_upd before update on event_editions for each row execute function set_updated_at();

create table site_settings (
  key text primary key,
  value jsonb not null default '{}',
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger t_upd before update on site_settings for each row execute function set_updated_at();
