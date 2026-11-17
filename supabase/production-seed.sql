-- Production seed: ONLY real configuration, no fictional people, payments, testimonials or content.
-- Run once after the migrations. Registration starts CLOSED and every payment method starts DISABLED with fee 0:
-- the organizer opens registration and sets real fees / UPI / bank details in Admin -> Event settings / Payment settings.
insert into events (slug, name) values ('influencia', 'Influencia') on conflict (slug) do nothing;

insert into event_editions (event_id, edition_number, code, title, subtitle, starts_at, timezone, venue_name, venue_city,
  status, is_featured, capacity, waitlist_enabled, registration_open)
select id, 3, 'INF3', 'Influencia – Edition 3', 'Programming 2027: Shaping the Year Ahead…',
  '2026-12-19 00:00:00+05:30', 'Asia/Kolkata', 'Hotel Tiara', 'Calicut, Kerala, India',
  'upcoming', true, 200, false, false
from events where slug = 'influencia'
on conflict (code) do nothing;

insert into payment_settings (edition_id, method_code, enabled, fee_amount, currency)
select e.id, m.code, false, 0, 'INR' from event_editions e cross join payment_methods m where e.code = 'INF3'
on conflict (edition_id, method_code) do nothing;
-- Then create the first super admin (see README: "Create the first super admin").
