-- 好租 Howzu：用户自助发布房源。在 Supabase SQL Editor 里整段运行一次。
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','live','rejected','let')),
  kind text not null default '整套出租',
  title text not null check (char_length(title) between 4 and 80),
  address text not null check (char_length(address) between 5 and 200),
  suburb text,
  lat double precision, lng double precision,
  beds int check (beds between 0 and 10),
  baths int check (baths between 0 and 10),
  cars int check (cars between 0 and 10),
  rent_weekly int check (rent_weekly between 50 and 20000),
  available text,
  furnished text,
  highlights text[] default '{}',
  description text check (char_length(description) <= 3000),
  contact_name text check (char_length(contact_name) <= 40),
  contact_phone text check (char_length(contact_phone) <= 30),
  contact_wechat text check (char_length(contact_wechat) <= 40),
  photos text[] not null default '{}' check (array_length(photos,1) <= 20),
  review_note text
);
alter table public.listings enable row level security;

-- 任何人都能提交，但只能提交成"待审核"
drop policy if exists "anyone can submit pending" on public.listings;
create policy "anyone can submit pending" on public.listings
  for insert to anon, authenticated with check (status = 'pending');

-- 公众只能看到已通过的
drop policy if exists "public reads live" on public.listings;
create policy "public reads live" on public.listings
  for select to anon, authenticated using (status in ('live','let'));

-- 管理员（老板邮箱登录）能看、改、删全部
drop policy if exists "admin all" on public.listings;
create policy "admin all" on public.listings
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'fanicyn@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'fanicyn@gmail.com');

-- 照片桶：公开可读，任何人可上传图片（单张 ≤ 3MB），只有管理员能删
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos','listing-photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "anyone uploads listing photos" on storage.objects;
create policy "anyone uploads listing photos" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'listing-photos');

drop policy if exists "admin deletes listing photos" on storage.objects;
create policy "admin deletes listing photos" on storage.objects
  for delete to authenticated using (bucket_id = 'listing-photos' and (auth.jwt() ->> 'email') = 'fanicyn@gmail.com');

grant select, insert on public.listings to anon, authenticated;
grant update, delete on public.listings to authenticated;
