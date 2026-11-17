-- 0016: shared rate limiter, FK indexes, RLS performance fixes (Supabase advisors).

-- 1) Shared fixed-window rate limiter (works across serverless instances). Service-role only.
create table rate_limits (
  key text primary key,
  count int not null,
  reset_at timestamptz not null
);
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

create or replace function rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if p_limit < 1 or p_window_seconds < 1 then raise exception 'invalid_args' using errcode='P0001'; end if;
  insert into rate_limits as r (key, count, reset_at) values (left(p_key, 200), 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    count = case when r.reset_at <= now() then 1 else r.count + 1 end,
    reset_at = case when r.reset_at <= now() then now() + make_interval(secs => p_window_seconds) else r.reset_at end
  returning count into c;
  if random() < 0.02 then delete from rate_limits where reset_at < now() - interval '1 hour'; end if;
  return c <= p_limit;
end $$;
revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, int, int) to service_role;

-- 2) Covering indexes for foreign keys.
create index if not exists admin_users_role_idx on admin_users (role_code);
create index if not exists blog_articles_category_idx on blog_articles (category_id);
create index if not exists certificate_templates_edition_idx on certificate_templates (edition_id);
create index if not exists certificates_template_idx on certificates (template_id);
create index if not exists media_gallery_category_idx on media_gallery (category_id);
create index if not exists media_videos_category_idx on media_videos (category_id);
create index if not exists notifications_registration_idx on notifications (registration_id);
create index if not exists payment_proofs_payment_idx on payment_proofs (payment_id);
create index if not exists payment_settings_method_idx on payment_settings (method_code);
create index if not exists refunds_payment_idx on refunds (payment_id);
create index if not exists registrations_participant_idx on registrations (participant_id);
create index if not exists role_permissions_permission_idx on role_permissions (permission_code);
create index if not exists testimonials_edition_idx on testimonials (edition_id);

-- 3) RLS: evaluate auth.uid() once per query, not per row.
drop policy if exists adm_admins_r on admin_users;
create policy adm_admins_r on admin_users for select using (auth_user_id = (select auth.uid()) or private.has_permission('admins.manage'));

-- 4) RLS: split FOR ALL admin policies so SELECT has fewer overlapping permissive policies.
do $$ declare p record; begin
  for p in select policyname, tablename, qual, with_check from pg_policies where schemaname = 'public' and cmd = 'ALL' and policyname like 'adm\_%' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I for insert with check (%s)', p.policyname || '_i', p.tablename, coalesce(p.with_check, p.qual));
    execute format('create policy %I on public.%I for update using (%s) with check (%s)', p.policyname || '_u', p.tablename, p.qual, coalesce(p.with_check, p.qual));
    execute format('create policy %I on public.%I for delete using (%s)', p.policyname || '_d', p.tablename, p.qual);
  end loop;
end $$;

-- 5) Anonymous users hold no privilege of any kind on sensitive tables (not even REFERENCES/TRIGGER).
revoke all on participants, registrations, registration_history, payments, payment_events, payment_proofs, payment_webhooks,
  payment_settings, refunds, admin_users, roles, permissions, role_permissions, audit_logs, attendance, certificates,
  certificate_templates, notifications, notification_templates, rate_limits from anon;
