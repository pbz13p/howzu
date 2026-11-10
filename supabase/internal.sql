-- 好租 Howzu 内部工作台（多区块）。在 Supabase SQL Editor 里整段运行一次；可重复运行。
-- 原则：钱和信托账户的正式账本在 PropertyMe；这里只管房源状态、统计、照片和对外发布。不存银行账户、BPAY、租客证件。
-- 权限：
--   总管理员（super_admins）：看所有区块、管理账号。目前只有老板一人。
--   区块（orgs）：例如 Cendant；以后合作伙伴、其他中介各自一个区块，彼此看不到。
--   成员（members）：某邮箱在某区块的身份 admin / staff / viewer（viewer 只能看不能改）。

create table if not exists public.super_admins (email text primary key check (email = lower(email)));
insert into public.super_admins values ('fanicyn@gmail.com') on conflict do nothing;

create table if not exists public.orgs (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  created_at timestamptz not null default now()
);
insert into public.orgs (id, name) values ('cendant', 'Cendant 盛腾') on conflict do nothing;

create table if not exists public.members (
  email text not null check (email = lower(email)),
  org_id text not null references public.orgs(id) on delete cascade,
  role text not null default 'staff' check (role in ('admin','staff','viewer')),
  name text,
  added_at timestamptz not null default now(),
  primary key (email, org_id)
);

create or replace function public.my_email() returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.super_admins where email = public.my_email());
$$;
create or replace function public.can_read_org(o text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super() or exists (select 1 from public.members where email = public.my_email() and org_id = o);
$$;
create or replace function public.can_write_org(o text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super() or exists (select 1 from public.members where email = public.my_email() and org_id = o and role in ('admin','staff'));
$$;
-- 兼容旧名字：is_staff() = 至少是某个区块的成员
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super() or exists (select 1 from public.members where email = public.my_email());
$$;
revoke all on function public.is_super(), public.can_read_org(text), public.can_write_org(text), public.is_staff() from public;
grant execute on function public.my_email(), public.is_super(), public.can_read_org(text), public.can_write_org(text), public.is_staff() to authenticated;

alter table public.super_admins enable row level security;
drop policy if exists "super reads super" on public.super_admins;
create policy "super reads super" on public.super_admins for select to authenticated using (email = public.my_email() or public.is_super());

alter table public.orgs enable row level security;
drop policy if exists "read own orgs" on public.orgs;
create policy "read own orgs" on public.orgs for select to authenticated using (public.can_read_org(id));
drop policy if exists "super manages orgs" on public.orgs;
create policy "super manages orgs" on public.orgs for all to authenticated using (public.is_super()) with check (public.is_super());

alter table public.members enable row level security;
drop policy if exists "read own membership" on public.members;
create policy "read own membership" on public.members for select to authenticated using (email = public.my_email() or public.is_super());
drop policy if exists "super manages members" on public.members;
create policy "super manages members" on public.members for all to authenticated using (public.is_super()) with check (public.is_super());

grant select, insert, update, delete on public.super_admins, public.orgs, public.members to authenticated;
revoke all on public.super_admins, public.orgs, public.members from anon;

-- 内部房源表
create table if not exists public.internal_props (
  id text primary key,                    -- 内部编号，如 1304a-spencer
  org_id text not null default 'cendant' references public.orgs(id),
  pub_id text unique,                     -- 对外页面用的编号（和 data/listings.json 的 id 对上）
  addr text not null,                     -- 完整地址（含门牌号，只在内部显示）
  suburb text,
  kind text not null default '公寓',       -- 公寓 / 联排别墅 / 独立屋 / 车位
  beds int, baths int, cars int,
  status text not null default 'leased' check (status in ('leased','vacant','airbnb','archived')),
  rent_month numeric,
  bond numeric,
  lease_start date, lease_end date, paid_to date,
  mgmt_since date,
  mgmt_pct numeric,
  owner text,
  late_rate numeric,
  flags jsonb not null default '{}',
  notes text,
  pub jsonb not null default '{}',        -- 对外展示内容，只放能公开的
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.internal_props add column if not exists org_id text not null default 'cendant' references public.orgs(id);
alter table public.internal_props enable row level security;
drop policy if exists "staff all internal_props" on public.internal_props;
drop policy if exists "org read props" on public.internal_props;
create policy "org read props" on public.internal_props for select to authenticated using (public.can_read_org(org_id));
drop policy if exists "org write props" on public.internal_props;
create policy "org write props" on public.internal_props for update to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));
drop policy if exists "org insert props" on public.internal_props;
create policy "org insert props" on public.internal_props for insert to authenticated with check (public.can_write_org(org_id));
drop policy if exists "super delete props" on public.internal_props;
create policy "super delete props" on public.internal_props for delete to authenticated using (public.is_super());
revoke all on public.internal_props from anon;
grant select, insert, update, delete on public.internal_props to authenticated;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists internal_props_touch on public.internal_props;
create trigger internal_props_touch before update on public.internal_props
  for each row execute function public.touch_updated_at();

-- 对外视图：只暴露"已发布"房源的公开内容（不含门牌号、业主、租金账目、区块）
drop view if exists public.public_props;
create view public.public_props with (security_invoker = false) as
  select coalesce(pub_id, id) as id, pub, updated_at
  from public.internal_props
  where published;
revoke all on public.public_props from anon, authenticated;
grant select on public.public_props to anon, authenticated;

-- 用户自助发布的房源（listings 表）：审核权限 = 总管理员
drop policy if exists "admin all" on public.listings;
create policy "admin all" on public.listings for all to authenticated
  using (public.is_super()) with check (public.is_super());
drop policy if exists "admin deletes listing photos" on storage.objects;
create policy "admin deletes listing photos" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and public.is_super());

drop table if exists public.staff;  -- 早期草稿用过的表，已被 members 取代
