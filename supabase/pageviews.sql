-- 好租网站访问统计（自建，不用第三方账号）。老板在 Supabase SQL Editor 里运行一次即可。
-- 只记录：哪个页面、从哪来（只留域名）、手机还是电脑、时间。不记录 IP，不用 cookie。
create table if not exists public.pageviews (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  path text not null check (char_length(path) <= 200),
  ref text check (char_length(ref) <= 100),
  mobile boolean,
  ev text check (char_length(ev) <= 40)          -- 'view' 或 咨询类事件，如 'wechat' 'call' 'book' 'lead'
);
alter table public.pageviews enable row level security;
-- 任何访客只能“写一条”，不能读
drop policy if exists "anon insert pageviews" on public.pageviews;
create policy "anon insert pageviews" on public.pageviews for insert to anon, authenticated with check (true);
-- 只有超级管理员能看
drop policy if exists "super read pageviews" on public.pageviews;
create policy "super read pageviews" on public.pageviews for select to authenticated using (public.is_super());
grant insert on public.pageviews to anon, authenticated;
grant select on public.pageviews to authenticated;
create index if not exists pageviews_at on public.pageviews (at desc);

-- 每日汇总（只有超级管理员能查，因为底表有 RLS 且视图用调用者权限）
create or replace view public.pageviews_daily with (security_invoker = true) as
select date_trunc('day', at at time zone 'Australia/Melbourne')::date as day,
       count(*) filter (where ev = 'view') as views,
       count(*) filter (where ev <> 'view') as enquiries,
       count(*) filter (where ev = 'view' and mobile) as mobile_views
from public.pageviews group by 1 order by 1 desc;
grant select on public.pageviews_daily to authenticated;
