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
