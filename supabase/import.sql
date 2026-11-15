-- 好租：贴帖入库（房东授权版）。在 Supabase SQL Editor 里整段运行一次。不改 listings 表结构。
-- 流程：老板征得房东同意 → 后台“贴帖入库”生成草稿（listings.kind = '待房东确认'，status = 'pending'，不公开）
--      → 房东打开确认链接核对、填固定周租、勾选业主授权 → kind 改成正常类型，进入“待审核” → 老板审核上线。
-- 房东联系方式和确认口令存在单独的私密表 listing_owners（只有老板能看），不放进公开可读的 listings。
-- 上线后 30 天没续期提醒老板（邮件），45 天自动下架。

create table if not exists public.listing_owners (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  token text not null check (char_length(token) between 20 and 64),
  contact_name text check (char_length(contact_name) <= 40),
  contact_phone text check (char_length(contact_phone) <= 30),
  contact_wechat text check (char_length(contact_wechat) <= 40),
  source text check (char_length(source) <= 40),          -- 来源：微信群 / 小红书 / 其它
  consent_note text check (char_length(consent_note) <= 200), -- 老板记一笔：什么时候、怎么征得同意的
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  renewed_at timestamptz,
  reminded_at timestamptz
);
alter table public.listing_owners enable row level security;
drop policy if exists "super only owners" on public.listing_owners;
create policy "super only owners" on public.listing_owners for all to authenticated using (public.is_super()) with check (public.is_super());
grant select, insert, update, delete on public.listing_owners to authenticated;

-- 房东打开确认页：凭口令读草稿（不含任何联系方式）
create or replace function public.howzu_get_draft(p_id uuid, p_token text) returns json
language sql security definer set search_path = public stable as $$
  select json_build_object('id', l.id, 'status', l.status, 'kind', l.kind, 'title', l.title, 'address', l.address, 'suburb', l.suburb,
    'beds', l.beds, 'baths', l.baths, 'cars', l.cars, 'rent_weekly', l.rent_weekly, 'available', l.available, 'furnished', l.furnished,
    'highlights', l.highlights, 'description', l.description, 'photos', l.photos, 'confirmed_at', o.confirmed_at, 'renewed_at', o.renewed_at)
  from listings l join listing_owners o on o.listing_id = l.id
  where l.id = p_id and o.token = p_token;
$$;

-- 房东确认：必须写固定周租（维州 RTA s30F）、必须勾选业主授权；确认后进入老板的“待审核”
create or replace function public.howzu_confirm_draft(p_id uuid, p_token text, p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare o listing_owners; l listings; k text; r int;
begin
  select * into o from listing_owners where listing_id = p_id and token = p_token;
  if not found then return 'bad_token'; end if;
  select * into l from listings where id = p_id;
  if l.kind <> '待房东确认' then return 'already'; end if;
  if coalesce((p->>'authority')::boolean, false) is not true then return 'need_authority'; end if;
  r := nullif(p->>'rent_weekly', '')::int;
  if r is null or r < 50 or r > 20000 then return 'need_rent'; end if;
  k := coalesce(nullif(p->>'kind', ''), '整套出租');
  if k not in ('整套出租', '单间出租', '转租 / 顶租约', '短租') then k := '整套出租'; end if;
  update listings set kind = k, rent_weekly = r,
    title = coalesce(nullif(left(p->>'title', 80), ''), title),
    address = case when char_length(coalesce(p->>'address', '')) between 5 and 200 then p->>'address' else address end,
    beds = coalesce(nullif(p->>'beds', '')::int, beds), baths = coalesce(nullif(p->>'baths', '')::int, baths), cars = coalesce(nullif(p->>'cars', '')::int, cars),
    available = coalesce(nullif(left(p->>'available', 40), ''), available), furnished = coalesce(nullif(left(p->>'furnished', 10), ''), furnished),
    highlights = coalesce((select array_agg(left(x, 40)) from jsonb_array_elements_text(p->'highlights') x), highlights),
    description = coalesce(left(p->>'description', 3000), description),
    review_note = left(coalesce(review_note || ' · ', '') || '房东已确认 ' || to_char(now() at time zone 'Australia/Melbourne', 'YYYY-MM-DD'), 500)
  where id = p_id;
  update listing_owners set confirmed_at = now(), renewed_at = now() where listing_id = p_id;
  return 'ok';
end $$;

-- 已上线的房源：房东点“还在出租”续期，可顺手改租金和入住日期
create or replace function public.howzu_renew(p_id uuid, p_token text, p_rent int, p_available text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from listing_owners where listing_id = p_id and token = p_token) then return 'bad_token'; end if;
  update listings set rent_weekly = case when p_rent between 50 and 20000 then p_rent else rent_weekly end,
    available = coalesce(nullif(left(p_available, 40), ''), available) where id = p_id and status = 'live';
  if not found then return 'not_live'; end if;
  update listing_owners set renewed_at = now() where listing_id = p_id;
  return 'ok';
end $$;
grant execute on function public.howzu_get_draft(uuid, text), public.howzu_confirm_draft(uuid, text, jsonb), public.howzu_renew(uuid, text, int, text) to anon, authenticated;

-- 每天检查：上线 30 天没续期 → 邮件提醒老板（附续期链接，老板转给房东）；45 天没续期 → 自动下架
create extension if not exists pg_net;
create extension if not exists pg_cron;
create or replace function public.howzu_stale() returns void
language plpgsql security definer set search_path = public as $$
declare x record;
begin
  update listings l set status = 'rejected', review_note = left(coalesce(review_note || ' · ', '') || '45 天未续期，自动下架', 500)
  from listing_owners o where o.listing_id = l.id and l.status = 'live' and coalesce(o.renewed_at, o.created_at) < now() - interval '45 days';
  for x in select l.id, l.title, o.token from listings l join listing_owners o on o.listing_id = l.id
    where l.status = 'live' and coalesce(o.renewed_at, o.created_at) < now() - interval '30 days'
      and (o.reminded_at is null or o.reminded_at < coalesce(o.renewed_at, o.created_at)) loop
    perform net.http_post(
      url := 'https://ntfy.sh/',
      body := jsonb_build_object('topic', 'howzu-approve-ca31ae596221c70ccb', 'title', '好租：房源 30 天没续期',
        'message', x.title || ' 已上线 30 天。请把续期链接发给房东，15 天内不续期会自动下架：https://howzu.com.au/confirm.html?id=' || x.id || '&t=' || x.token,
        'email', '你的邮箱@example.com', 'click', 'https://howzu.com.au/confirm.html?id=' || x.id || '&t=' || x.token),
      headers := '{"Content-Type": "application/json"}'::jsonb);
    update listing_owners set reminded_at = now() where listing_id = x.id;
  end loop;
end $$;
revoke execute on function public.howzu_stale() from anon, authenticated;
select cron.unschedule('howzu-stale') where exists (select 1 from cron.job where jobname = 'howzu-stale');
select cron.schedule('howzu-stale', '0 22 * * *', 'select public.howzu_stale()');  -- 每天 UTC 22:00（墨尔本早上 9 点左右）
