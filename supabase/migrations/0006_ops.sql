-- 0006_ops: attendance, certificates, notifications
create table attendance (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references registrations(id) on delete restrict,
  checked_in_at timestamptz not null default now(),
  method text not null check (method in ('qr','manual')),
  checked_in_by uuid,
  corrected_by uuid,
  correction_note text
);
create table certificate_templates (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references event_editions(id) on delete cascade,
  name text not null,
  config jsonb not null default '{}',     -- organizer name, signature path, layout
  active boolean not null default true
);
create table certificates (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references registrations(id) on delete restrict,
  template_id uuid references certificate_templates(id),
  certificate_code text not null unique,
  pdf_path text,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz
);
create table notification_templates (
  key text primary key,
  subject text,
  body text not null,
  updated_at timestamptz not null default now()
);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references registrations(id) on delete set null,
  channel text not null check (channel in ('email','whatsapp_link')),
  template_key text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
