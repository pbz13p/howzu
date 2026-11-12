-- 好租工作台：账号申请（自己注册 → 老板审批 → 才能看内部资料）。老板在 Supabase SQL Editor 里运行一次即可。
-- 注册本身不给任何权限：内部表的规则只认 super_admins 和 members。这张表只用来“排队等审批”。
create table if not exists public.access_requests (
  email text primary key check (char_length(email) <= 120),
  name text check (char_length(name) <= 40),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
alter table public.access_requests enable row level security;
-- 申请人只能写、改、看自己那一条（邮箱必须是已验证登录的邮箱）
drop policy if exists "own request insert" on public.access_requests;
create policy "own request insert" on public.access_requests for insert to authenticated with check (lower(email) = public.my_email());
drop policy if exists "own request update" on public.access_requests;
create policy "own request update" on public.access_requests for update to authenticated using (lower(email) = public.my_email()) with check (lower(email) = public.my_email());
-- 超级管理员能看全部、能删除（批准或拒绝后删掉申请）
drop policy if exists "own or super read requests" on public.access_requests;
create policy "own or super read requests" on public.access_requests for select to authenticated using (lower(email) = public.my_email() or public.is_super());
drop policy if exists "super delete requests" on public.access_requests;
create policy "super delete requests" on public.access_requests for delete to authenticated using (public.is_super());
grant select, insert, update, delete on public.access_requests to authenticated;

-- 有人提交申请时，发邮件通知老板（经 ntfy.sh 转发邮件，不用另开账号）。邮件里的链接直接打开工作台审批页。
-- 运行前把下面的 你的邮箱@example.com 换成老板邮箱。
create extension if not exists pg_net;
create or replace function public.notify_access_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://ntfy.sh/',
    body := jsonb_build_object(
      'topic', 'howzu-approve-ca31ae596221c70ccb',
      'title', '好租工作台：有人申请开通账号',
      'message', coalesce(new.name, '（没填称呼）') || ' ' || new.email || coalesce(E'\n说明：' || new.note, '') || E'\n点链接登录工作台审批（批准前对方看不到任何内部资料）。',
      'click', 'https://howzu.com.au/work.html?tab=staff',
      'email', '你的邮箱@example.com'),
    headers := '{"Content-Type": "application/json"}'::jsonb);
  return new;
end $$;
drop trigger if exists access_request_notify on public.access_requests;
create trigger access_request_notify after insert on public.access_requests for each row execute function public.notify_access_request();
