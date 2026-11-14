begin;
create table public.push_config(id boolean primary key default true check(id), public_key text not null,private_key text not null,webhook_secret text not null,dispatch_url text not null);
create table public.push_devices(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),endpoint text not null unique,p256dh text not null,auth text not null,label text not null default '브라우저',active_room uuid,active_until timestamptz,updated_at timestamptz not null default now());
create table public.push_jobs(id bigint generated always as identity primary key,message_id uuid not null references public.messages(id),device_id uuid not null references public.push_devices(id) on delete cascade,status text not null default 'pending',attempts integer not null default 0,next_attempt timestamptz not null default now(),created_at timestamptz not null default now(),unique(message_id,device_id));
create index push_jobs_pending on public.push_jobs(next_attempt) where status='pending';
alter table public.push_config enable row level security;
alter table public.push_devices enable row level security;
alter table public.push_jobs enable row level security;
revoke all on public.push_config,public.push_devices,public.push_jobs from public,anon,authenticated;
grant all on public.push_config,public.push_devices,public.push_jobs to service_role;
grant usage,select on sequence public.push_jobs_id_seq to service_role;
create function public.get_push_public_key() returns text language sql security definer set search_path='' as $$ select public_key from public.push_config where id=true $$;
create function public.register_push(p_endpoint text,p_p256dh text,p_auth text,p_label text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); device uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_endpoint is null or char_length(p_endpoint)>2048 or p_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|[a-z0-9.-]+[.]notify[.]windows[.]com)/' or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}=?$' or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}={0,2}$' then raise exception '지원하지 않는 푸시 구독입니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('push:'||actor::text,0));
 if (select count(*) from public.push_devices where user_id=actor)>=10 and not exists(select 1 from public.push_devices where user_id=actor and endpoint=p_endpoint) then raise exception '기기 등록은 계정당 10개까지 가능합니다.'; end if;
 if exists(select 1 from public.push_devices where endpoint=p_endpoint and user_id<>actor) then raise exception '이 브라우저의 이전 구독을 먼저 해제해 주세요.'; end if;
 insert into public.push_devices(user_id,endpoint,p256dh,auth,label) values(actor,p_endpoint,p_p256dh,p_auth,left(coalesce(p_label,'브라우저'),40)) on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,label=excluded.label,updated_at=now() returning id into device;
 return device;
end $$;
create function public.remove_push(p_device uuid) returns void language sql security definer set search_path='' as $$ delete from public.push_devices where id=p_device and user_id=auth.uid() $$;
create function public.touch_push(p_device uuid,p_room uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_room is not null and not public.is_room_member(p_room) then raise exception 'Room access denied'; end if;
 update public.push_devices set active_room=p_room,active_until=case when p_room is null then null else now()+interval '25 seconds' end,updated_at=now() where id=p_device and user_id=auth.uid();
end $$;
create function public.claim_push_jobs() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with picked as (select j.id from public.push_jobs j where j.status='pending' and j.next_attempt<=now() and j.attempts<6 and j.created_at>now()-interval '1 day' order by j.id for update skip locked limit 30),
 claimed as (update public.push_jobs j set attempts=attempts+1,next_attempt=now()+interval '90 seconds' from picked where j.id=picked.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'attempts',j.attempts,'device_id',d.id,'endpoint',d.endpoint,'p256dh',d.p256dh,'auth',d.auth,'room_id',m.room_id,'user_id',d.user_id,'skip',public.social_blocked(m.sender_id,d.user_id) or (d.active_room=m.room_id and d.active_until>now()))),'[]'::jsonb) into result from claimed j join public.push_devices d on d.id=j.device_id join public.messages m on m.id=j.message_id;
 return result;
end $$;
create function public.enqueue_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.push_jobs(message_id,device_id)
 select new.id,d.id from public.push_devices d join public.chat_members m on m.user_id=d.user_id and m.room_id=new.room_id
 where d.user_id<>new.sender_id and not public.social_blocked(new.sender_id,d.user_id)
 and not coalesce(d.active_room=new.room_id and d.active_until>now(),false) on conflict do nothing;
 return new;
end $$;
create trigger enqueue_message_push after insert on public.messages for each row execute function public.enqueue_push();
revoke all on function public.enqueue_push(),public.claim_push_jobs() from public,anon,authenticated;
grant execute on function public.claim_push_jobs() to service_role;
revoke all on function public.get_push_public_key(),public.register_push(text,text,text,text),public.remove_push(uuid),public.touch_push(uuid,uuid) from public,anon;
grant execute on function public.get_push_public_key(),public.register_push(text,text,text,text),public.remove_push(uuid),public.touch_push(uuid,uuid) to authenticated;
commit;
