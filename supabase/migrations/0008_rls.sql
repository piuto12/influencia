-- 0008_rls: default deny everywhere; explicit policies below.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Public read (published content only)
create policy pub_events on events for select using (true);
create policy pub_editions on event_editions for select using (status <> 'draft');
create policy pub_settings on site_settings for select using (is_public);
create policy pub_methods on payment_methods for select using (true);
create policy pub_cats on media_categories for select using (true);
create policy pub_gallery on media_gallery for select using (status = 'published');
create policy pub_videos on media_videos for select using (status = 'published');
create policy pub_testimonials on testimonials for select using (status = 'published');
create policy pub_sections on homepage_sections for select using (status = 'published');
create policy pub_pages on content_pages for select using (status = 'published');
create policy pub_blog on blog_articles for select using (status = 'published' and (published_at is null or published_at <= now()));
create policy pub_social on social_links for select using (enabled);

-- Admin policies (permission-based). Writes by service role bypass RLS after server-side authz.
create policy adm_editions_w on event_editions for all using (has_permission('events.manage')) with check (has_permission('events.manage'));
create policy adm_editions_r on event_editions for select using (is_admin());
create policy adm_events_w on events for all using (has_permission('events.manage')) with check (has_permission('events.manage'));
create policy adm_settings on site_settings for all using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy adm_participants_r on participants for select using (has_permission('participants.read'));
create policy adm_participants_w on participants for update using (has_permission('participants.write'));
create policy adm_regs_r on registrations for select using (has_permission('participants.read'));
create policy adm_regs_w on registrations for update using (has_permission('registrations.review'));
create policy adm_hist_r on registration_history for select using (has_permission('participants.read'));

create policy adm_pay_settings on payment_settings for all using (has_permission('payments.configure')) with check (has_permission('payments.configure'));
create policy adm_payments_r on payments for select using (has_permission('payments.read'));
create policy adm_pay_events_r on payment_events for select using (has_permission('payments.read'));
create policy adm_proofs_r on payment_proofs for select using (has_permission('payments.read'));
create policy adm_webhooks_r on payment_webhooks for select using (has_permission('payments.read'));
create policy adm_refunds_r on refunds for select using (has_permission('payments.read'));

create policy adm_roles_r on roles for select using (is_admin());
create policy adm_perms_r on permissions for select using (is_admin());
create policy adm_rp_r on role_permissions for select using (is_admin());
create policy adm_admins_r on admin_users for select using (auth_user_id = auth.uid() or has_permission('admins.manage'));
create policy adm_admins_w on admin_users for all using (has_permission('admins.manage')) with check (has_permission('admins.manage'));
create policy adm_audit_r on audit_logs for select using (has_permission('audit.read'));

create policy adm_gallery on media_gallery for all using (has_permission('media.manage')) with check (has_permission('media.manage'));
create policy adm_videos on media_videos for all using (has_permission('media.manage')) with check (has_permission('media.manage'));
create policy adm_testimonials on testimonials for all using (has_permission('media.manage')) with check (has_permission('media.manage'));
create policy adm_cats on media_categories for all using (has_permission('media.manage')) with check (has_permission('media.manage'));
create policy adm_sections on homepage_sections for all using (has_permission('content.manage')) with check (has_permission('content.manage'));
create policy adm_pages on content_pages for all using (has_permission('content.manage')) with check (has_permission('content.manage'));
create policy adm_blog on blog_articles for all using (has_permission('content.manage')) with check (has_permission('content.manage'));
create policy adm_social on social_links for all using (has_permission('settings.manage')) with check (has_permission('settings.manage'));

create policy adm_attendance on attendance for select using (has_permission('attendance.manage'));
create policy adm_cert_tpl on certificate_templates for all using (has_permission('certificates.manage')) with check (has_permission('certificates.manage'));
create policy adm_certs_r on certificates for select using (has_permission('certificates.manage'));
create policy adm_notif_tpl on notification_templates for all using (has_permission('settings.manage')) with check (has_permission('settings.manage'));
create policy adm_notif_r on notifications for select using (has_permission('participants.read'));

-- Append-only: nobody (except via service role inserts) may modify history/ledger tables.
revoke update, delete, truncate on audit_logs, payment_events, registration_history, payment_webhooks from anon, authenticated;
-- Anonymous users get no write privileges on any table; all public writes go through server actions.
revoke insert, update, delete, truncate on all tables in schema public from anon;

-- Defence in depth: anon has no table privileges on sensitive tables at all.
revoke select on participants, registrations, registration_history, payments, payment_events,
  payment_proofs, payment_webhooks, payment_settings, refunds, admin_users, roles, permissions,
  role_permissions, audit_logs, attendance, certificates, certificate_templates,
  notifications, notification_templates from anon;
