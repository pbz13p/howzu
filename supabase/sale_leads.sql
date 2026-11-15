-- 在售房源页「💬 咨询」小助手：有人留了联系方式（listings 表 kind = '买房咨询'）就推送到 Frank 手机的 ntfy App（订阅主题 howzu-sale-lead-7f3c91e2b84d5a06）。
-- ntfy.sh 不允许匿名发邮件（错误 40053），所以只推送；主题名放在数据库里，网页源码看不到。已于 15/11/2026 在 Supabase 运行。
create extension if not exists pg_net;
create or replace function public.notify_sale_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = '买房咨询' then
    perform net.http_post(
      url := 'https://ntfy.sh/',
      body := jsonb_build_object(
        'topic', 'howzu-sale-lead-7f3c91e2b84d5a06',
        'title', '好租：新的买房咨询 · ' || coalesce(new.address, ''),
        'message', coalesce(new.description, ''),
        'click', 'https://howzu.com.au/admin.html',
        'priority', 4),
      headers := '{"Content-Type": "application/json"}'::jsonb);
  end if;
  return new;
end $$;
drop trigger if exists sale_lead_notify on public.listings;
create trigger sale_lead_notify after insert on public.listings for each row execute function public.notify_sale_lead();
