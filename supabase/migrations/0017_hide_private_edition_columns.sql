-- 0017: the public API (anon/authenticated roles) must never read event_editions.whatsapp_group_url.
-- RLS filters ROWS, not columns, so column privileges are used. The app reads this column only with the service role.
-- NOTE: columns added to event_editions in future migrations are NOT public until granted here on purpose.
revoke select on event_editions from anon, authenticated;
grant select (id, event_id, edition_number, code, title, subtitle, starts_at, ends_at, timezone, venue_name, venue_city,
              venue_address, status, is_featured, capacity, waitlist_enabled, registration_open, registration_deadline,
              attendance_rule, cta_config, seo, created_at, updated_at)
  on event_editions to anon, authenticated;
