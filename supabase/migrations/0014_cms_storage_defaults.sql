-- 0014: public media bucket + default homepage sections.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('public-media','public-media', true, 52428800,
            array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- Global (edition-independent) default sections; the homepage hero is fixed in code.
insert into homepage_sections (edition_id, type, sort_order, status, content)
select null, v.type, v.ord, 'published', v.content::jsonb from (values
  ('speaker', 10, '{"eyebrow":"Meet the speaker","title":"Dr. Rashid Gazzali"}'),
  ('about', 20, '{"eyebrow":"About Influencia","title":"A full-day programme to shape the year ahead."}'),
  ('prp', 30, '{"eyebrow":"The PRP Framework","title":"Three pillars. One year designed on purpose."}'),
  ('highlights', 40, '{"eyebrow":"Workshop highlights","title":"What the day covers"}'),
  ('video', 50, '{"eyebrow":"Featured video","title":"Watch the promotional film"}'),
  ('editions', 60, '{"eyebrow":"Previous editions","title":"The Influencia journey"}'),
  ('testimonials', 70, '{"eyebrow":"Testimonials","title":"In participants’ words"}'),
  ('gallery', 80, '{"eyebrow":"Photo gallery","title":"Moments from Influencia"}'),
  ('blog', 90, '{"eyebrow":"Blog & articles","title":"Ideas worth sharing"}'),
  ('contact', 100, '{"eyebrow":"Contact","title":"Questions? Talk to the team."}')
) as v(type, ord, content)
where not exists (select 1 from homepage_sections);
