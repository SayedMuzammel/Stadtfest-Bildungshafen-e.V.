-- ============================================================
--  Bildungshafen Speisekarte – Supabase Schema
--  Run this once in:  Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- gen_random_uuid()
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
--  Tables
-- ------------------------------------------------------------

-- Site / festival settings (single row, id = 1)
create table if not exists public.site_settings (
  id          int primary key default 1,
  edition     text default '',
  title       text default '',
  organizer   text default '',
  tagline     text default '',
  note        text default '',
  social      jsonb default '{}'::jsonb,
  updated_at  timestamptz default now(),
  constraint site_settings_single_row check (id = 1)
);

-- Menu categories (Speisen, Süßspeisen, Getränke, …)
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,        -- used in the URL hash (#speisen)
  name        text not null,
  emoji       text default '',
  subtitle    text default '',
  sort_order  int default 0,
  created_at  timestamptz default now()
);

-- Menu items
create table if not exists public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.categories(id) on delete cascade,
  name          text not null,
  description   text default '',
  quantity      text default '',            -- optional portion label, e.g. "5 Stück"
  price         numeric(10,2) default 0,
  image_path    text,                       -- object key inside the 'menu-images' bucket
  sort_order    int default 0,
  is_available  boolean default true,
  created_at    timestamptz default now()
);

-- For projects created before the 'quantity' column existed:
alter table public.menu_items add column if not exists quantity text default '';

create index if not exists menu_items_category_idx on public.menu_items (category_id);
create index if not exists menu_items_sort_idx     on public.menu_items (category_id, sort_order);
create index if not exists categories_sort_idx     on public.categories (sort_order);

-- Keep one settings row present
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
--  Row Level Security
--  Everyone may READ. Only logged-in (admin) users may WRITE.
-- ------------------------------------------------------------
alter table public.site_settings enable row level security;
alter table public.categories    enable row level security;
alter table public.menu_items    enable row level security;

-- Public read
drop policy if exists "read_settings"   on public.site_settings;
drop policy if exists "read_categories" on public.categories;
drop policy if exists "read_items"      on public.menu_items;
create policy "read_settings"   on public.site_settings for select using (true);
create policy "read_categories" on public.categories    for select using (true);
create policy "read_items"      on public.menu_items    for select using (true);

-- Authenticated write (insert/update/delete)
drop policy if exists "write_settings"   on public.site_settings;
drop policy if exists "write_categories" on public.categories;
drop policy if exists "write_items"      on public.menu_items;
create policy "write_settings"   on public.site_settings for all to authenticated using (true) with check (true);
create policy "write_categories" on public.categories    for all to authenticated using (true) with check (true);
create policy "write_items"      on public.menu_items    for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
--  Storage bucket for images (public read, admin write)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

drop policy if exists "menu_images_read"   on storage.objects;
drop policy if exists "menu_images_insert" on storage.objects;
drop policy if exists "menu_images_update" on storage.objects;
drop policy if exists "menu_images_delete" on storage.objects;

create policy "menu_images_read"   on storage.objects for select
  using (bucket_id = 'menu-images');
create policy "menu_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-images');
create policy "menu_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'menu-images');
create policy "menu_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'menu-images');

-- ============================================================
--  DONE.
--  Next:
--   1) Authentication → Providers → Email: turn OFF "Allow new users to sign up".
--   2) Authentication → Users → "Add user": create your single admin
--      (e.g. admin@bildungshafen.de + a strong password). Confirm the email.
--   3) Put your Project URL + anon key into js/supabase-config.js
--   4) Open admin.html, log in, and run "Daten importieren" once.
-- ============================================================
