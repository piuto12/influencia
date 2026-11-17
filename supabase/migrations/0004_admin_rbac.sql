-- 0004_admin_rbac
create table roles (code text primary key, label text not null);
create table permissions (code text primary key);
create table role_permissions (
  role_code text not null references roles(code) on delete cascade,
  permission_code text not null references permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  role_code text not null references roles(code),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on audit_logs (actor_id, created_at desc);

insert into roles values ('super_admin','Super Admin'),('registration_admin','Registration Admin'),('finance_admin','Finance Admin');
insert into permissions (code) values
 ('participants.read'),('participants.write'),('registrations.review'),('attendance.manage'),
 ('payments.read'),('payments.verify'),('payments.refund'),('payments.configure'),
 ('reports.registration'),('reports.finance'),('content.manage'),('media.manage'),
 ('events.manage'),('settings.manage'),('admins.manage'),('certificates.manage'),('audit.read');
insert into role_permissions select 'super_admin', code from permissions;
insert into role_permissions values
 ('registration_admin','participants.read'),('registration_admin','participants.write'),
 ('registration_admin','registrations.review'),('registration_admin','attendance.manage'),
 ('registration_admin','certificates.manage'),('registration_admin','reports.registration'),
 ('finance_admin','payments.read'),('finance_admin','payments.verify'),
 ('finance_admin','payments.refund'),('finance_admin','reports.finance');

-- RLS helpers (security definer: callers cannot read admin tables directly)
create or replace function has_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users a join role_permissions rp on rp.role_code = a.role_code
    where a.auth_user_id = auth.uid() and a.active and rp.permission_code = p);
$$;
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where auth_user_id = auth.uid() and active);
$$;
