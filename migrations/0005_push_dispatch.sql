-- Apply only after push-dispatch and push_config are configured.
begin;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create function public.dispatch_push_jobs() returns void language plpgsql security definer set search_path='' as $$
declare config public.push_config;
begin
 if not exists(select 1 from public.push_jobs where status='pending' and next_attempt<=now() and attempts<6 and created_at>now()-interval '1 day') then return; end if;
 select * into config from public.push_config where id=true;
 if config.id is null then return; end if;
 perform net.http_post(url:=config.dispatch_url,headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',config.webhook_secret),body:='{}'::jsonb,timeout_milliseconds:=10000);
end $$;
create function public.kick_push_jobs() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.dispatch_push_jobs(); return null; end $$;
create trigger kick_message_push after insert on public.push_jobs for each statement execute function public.kick_push_jobs();
revoke all on function public.dispatch_push_jobs(),public.kick_push_jobs() from public,anon,authenticated;
select cron.schedule('web-messenger-push-retry','* * * * *','select public.dispatch_push_jobs()');
commit;
