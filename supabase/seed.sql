-- Development seed. Edition 3 details come from the organizer's brief (not fictional); NO participants,
-- payments or testimonials are seeded. Run only on a non-production database.
insert into events (slug, name) values ('influencia', 'Influencia') on conflict (slug) do nothing;

insert into event_editions (event_id, edition_number, code, title, subtitle, starts_at, timezone, venue_name, venue_city,
  status, is_featured, capacity, waitlist_enabled, registration_open)
select id, 3, 'INF3', 'Influencia – Edition 3', 'Programming 2027: Shaping the Year Ahead…',
  '2026-12-19 00:00:00+05:30', 'Asia/Kolkata', 'Hotel Tiara', 'Calicut, Kerala, India',
  'active', true, 200, false, true
from events where slug = 'influencia'
on conflict (code) do nothing;
-- whatsapp_group_url is set by an admin in the dashboard; it is never published to unapproved visitors.

-- Payment methods start DISABLED with a 0 fee: the organizer sets real fees, UPI ID and bank details in the admin dashboard.
insert into payment_settings (edition_id, method_code, enabled, fee_amount, currency)
select e.id, m.code, false, 0, 'INR' from event_editions e cross join payment_methods m where e.code = 'INF3'
on conflict (edition_id, method_code) do nothing;
