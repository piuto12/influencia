-- 0005_content_media
create type publish_status as enum ('draft','published');

create table media_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('gallery','video','blog')),
  name text not null,
  slug text not null,
  unique (kind, slug)
);
create table media_gallery (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references event_editions(id) on delete cascade,
  category_id uuid references media_categories(id) on delete set null,
  storage_path text not null,
  caption text,
  sort_order int not null default 0,
  featured boolean not null default false,
  status publish_status not null default 'draft',
  created_at timestamptz not null default now()
);
create table media_videos (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references event_editions(id) on delete cascade,
  category_id uuid references media_categories(id) on delete set null,
  source text not null check (source in ('youtube','vimeo','upload')),
  url text,
  storage_path text,
  thumbnail_path text,
  title text not null,
  description text,
  featured boolean not null default false,
  sort_order int not null default 0,
  status publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  check ((source = 'upload' and storage_path is not null) or (source <> 'upload' and url is not null))
);
create table testimonials (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references event_editions(id) on delete cascade,
  name text not null,
  designation text,
  organization text,
  photo_path text,
  feedback text,
  video_url text,
  rating smallint check (rating between 1 and 5),
  featured boolean not null default false,
  status publish_status not null default 'draft',   -- only 'published' (approved) is public
  created_at timestamptz not null default now()
);
create table homepage_sections (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references event_editions(id) on delete cascade,
  type text not null,
  sort_order int not null default 0,
  status publish_status not null default 'draft',
  content jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create table content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null default '',
  seo jsonb not null default '{}',
  status publish_status not null default 'draft',
  updated_at timestamptz not null default now()
);
create table blog_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text not null default '',
  author text,
  category_id uuid references media_categories(id) on delete set null,
  featured_image_path text,
  seo jsonb not null default '{}',
  status publish_status not null default 'draft',
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create table social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique check (platform in ('youtube','instagram','facebook','linkedin')),
  url text not null,
  enabled boolean not null default true
);
create index gallery_edition_idx on media_gallery (edition_id, status, sort_order);
create index videos_edition_idx on media_videos (edition_id, status, sort_order);
create index sections_idx on homepage_sections (edition_id, status, sort_order);
