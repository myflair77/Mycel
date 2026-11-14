-- Deploy the R2 Worker and configure R2_RECEIPT_KEY before enabling this job.
begin;
create function public.dispatch_file_retention() returns void language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 if not exists(select 1 from public.chat_attachments where r2_key is not null and expires_at<=now() and original_deleted_at is null) then return;end if;
 select key_hex into secret from public.r2_receipt_secret where id=true;
 if secret is null then return;end if;
 perform net.http_post(url:='https://web-messenger-jbh.myflair.chatgpt.site/api/retention/run',headers:=jsonb_build_object('Content-Type','application/json','X-Retention-Key',secret),body:='{}'::jsonb,timeout_milliseconds:=60000);
end $$;
revoke all on function public.dispatch_file_retention() from public,anon,authenticated;
select cron.schedule('web-messenger-file-retention','15 * * * *','select public.dispatch_file_retention()');
commit;
