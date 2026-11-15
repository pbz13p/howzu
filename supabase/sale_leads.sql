-- 在售房源页「💬 咨询」小助手：有人留了联系方式（listings 表 kind = '买房咨询'）就发邮件给 Frank。
-- 经 ntfy.sh 转发邮件（和工作台申请通知同一个办法），主题名放在数据库里，网页源码看不到。
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
        'email', 'fanicyn@gmail.com'),
      headers := '{"Content-Type": "application/json"}'::jsonb);
  end if;
  return new;
end $$;
drop trigger if exists sale_lead_notify on public.listings;
create trigger sale_lead_notify after insert on public.listings for each row execute function public.notify_sale_lead();
