begin;
-- Private throttling state; no raw email/password is stored.
create table public.signup_email_limits (
 scope_hash text primary key, window_start timestamptz not null,
 last_attempt timestamptz not null, attempts integer not null
);
alter table public.signup_email_limits enable row level security;
revoke all on public.signup_email_limits from public,anon,authenticated;
create function public.claim_signup_email_change(p_scopes text[])
returns boolean language plpgsql security definer set search_path='' as $$
declare s text; claimed text;
begin
 if array_length(p_scopes,1) <> 2 then return false; end if;
 foreach s in array p_scopes loop
  if s !~ '^[a-f0-9]{64}$' then return false; end if;
  claimed := null;
  insert into public.signup_email_limits as q values(s,now(),now(),1)
  on conflict(scope_hash) do update set
   window_start=case when q.window_start<now()-interval '1 hour' then now() else q.window_start end,
   attempts=case when q.window_start<now()-interval '1 hour' then 1 else q.attempts+1 end,
   last_attempt=now()
  where q.last_attempt<now()-interval '60 seconds'
   and (q.window_start<now()-interval '1 hour' or q.attempts<5)
  returning scope_hash into claimed;
  if claimed is null then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function public.claim_signup_email_change(text[]) from public,anon,authenticated;
grant execute on function public.claim_signup_email_change(text[]) to service_role;

-- Auth Admin API is still the only writer. This guard rejects a stale operation
-- if confirmation, password, or email changed while the password was checked.
create function public.guard_pending_signup_email() returns trigger
language plpgsql set search_path='' as $$
declare marker jsonb; prior jsonb;
begin
 -- GoTrue updates email first and app_metadata later in ONE transaction.
 -- Capture the row before the email write, then validate the marker against it.
 -- Raising below rolls the entire Auth transaction back, including its identity write.
 if new.email is distinct from old.email then
  perform set_config('mycel.signup_email_before',jsonb_build_object(
   'id',old.id,'email',old.email,'updated_at',old.updated_at,
   'email_confirmed_at',old.email_confirmed_at,'phone_confirmed_at',old.phone_confirmed_at,
   'next_email',new.email)::text,true);
 end if;
 marker:=new.raw_app_meta_data->'mycel_pending_email_change';
 if marker is not null then
  prior:=nullif(current_setting('mycel.signup_email_before',true),'')::jsonb;
  if prior is null or prior->>'id' is distinct from new.id::text
   or prior->>'email_confirmed_at' is not null or prior->>'phone_confirmed_at' is not null
   or prior->>'email' is distinct from marker->>'email'
   or (prior->>'updated_at')::timestamptz is distinct from (marker->>'updated_at')::timestamptz
   or prior->>'next_email' is distinct from new.email
   or new.email_confirmed_at is not null
   or new.encrypted_password is distinct from old.encrypted_password
   or new.id is distinct from old.id then
    raise exception 'Pending signup changed; reload and retry';
  end if;
  new.raw_app_meta_data:=new.raw_app_meta_data-'mycel_pending_email_change';
 end if;
 return new;
end $$;
revoke all on function public.guard_pending_signup_email() from public,anon,authenticated;
create trigger mycel_pending_signup_email_guard before update on auth.users
for each row execute function public.guard_pending_signup_email();
commit;

