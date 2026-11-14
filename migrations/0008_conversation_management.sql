begin;
create table public.room_preferences (
 room_id uuid not null references public.chat_rooms(id),
 user_id uuid not null references public.profiles(id),
 muted boolean not null default false,
 primary key(room_id,user_id)
);
alter table public.room_preferences enable row level security;
revoke all on public.room_preferences from public,anon,authenticated;
grant select on public.room_preferences to authenticated;
create policy room_preferences_read on public.room_preferences for select to authenticated using(user_id=auth.uid() and public.is_room_member(room_id));
create function public.set_room_muted(p_room uuid,p_muted boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_room_member(p_room) or p_muted is null then raise exception 'Room access denied' using errcode='42501'; end if;
 insert into public.room_preferences(room_id,user_id,muted) values(p_room,auth.uid(),p_muted) on conflict(room_id,user_id) do update set muted=excluded.muted;
 -- Also cancel queued retries for this user's devices. Already delivered notifications remain.
 if p_muted then update public.push_jobs j set status='skipped' from public.push_devices d,public.messages m where j.device_id=d.id and j.message_id=m.id and d.user_id=auth.uid() and m.room_id=p_room and j.status='pending'; end if;
 return p_muted;
end $$;
create function public.get_conversations() returns table(id uuid,direct_key text,peer jsonb,last_body text,last_at timestamptz,muted boolean)
language sql stable security definer set search_path='' as $$
 select r.id,r.direct_key,jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name),
 case when last.attachment_id is not null then '📎 '||left(last.body,160) else left(last.body,160) end,
 last.created_at,coalesce(pref.muted,false)
 from public.chat_rooms r join public.chat_members mine on mine.room_id=r.id and mine.user_id=auth.uid()
 left join public.chat_members other on other.room_id=r.id and other.user_id<>auth.uid()
 left join public.profiles p on p.id=other.user_id
 left join public.room_preferences pref on pref.room_id=r.id and pref.user_id=auth.uid()
 left join lateral (select m.body,m.created_at,m.attachment_id from public.messages m where m.room_id=r.id order by m.sequence desc limit 1) last on true
 order by coalesce(last.created_at,r.created_at) desc,r.id;
$$;
create function public.search_messages(p_room uuid,p_query text,p_before bigint default null) returns setof public.messages
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_room_member(p_room) then raise exception 'Room access denied' using errcode='42501'; end if;
 if p_query is null or char_length(trim(p_query)) not between 1 and 100 then raise exception '검색어는 1~100자로 입력해 주세요.'; end if;
 return query select m.* from public.messages m where m.room_id=p_room and (p_before is null or m.sequence<p_before) and strpos(lower(m.body),lower(trim(p_query)))>0 order by m.sequence desc limit 50;
end $$;
revoke all on function public.set_room_muted(uuid,boolean),public.get_conversations(),public.search_messages(uuid,text,bigint) from public,anon;
grant execute on function public.set_room_muted(uuid,boolean),public.get_conversations(),public.search_messages(uuid,text,bigint) to authenticated;
create or replace function public.claim_push_jobs() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with picked as (select j.id from public.push_jobs j where j.status='pending' and j.next_attempt<=now() and j.attempts<6 and j.created_at>now()-interval '1 day' order by j.id for update skip locked limit 30),
 claimed as (update public.push_jobs j set attempts=attempts+1,next_attempt=now()+interval '90 seconds' from picked where j.id=picked.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'attempts',j.attempts,'device_id',d.id,'endpoint',d.endpoint,'p256dh',d.p256dh,'auth',d.auth,'room_id',m.room_id,'user_id',d.user_id,'skip',public.social_blocked(m.sender_id,d.user_id) or coalesce((d.active_room=m.room_id and d.active_until>now()),false) or exists(select 1 from public.room_preferences pref where pref.room_id=m.room_id and pref.user_id=d.user_id and pref.muted))),'[]'::jsonb) into result from claimed j join public.push_devices d on d.id=j.device_id join public.messages m on m.id=j.message_id;
 return result;
end $$;
create or replace function public.enqueue_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.push_jobs(message_id,device_id)
 select new.id,d.id from public.push_devices d join public.chat_members m on m.user_id=d.user_id and m.room_id=new.room_id
 where d.user_id<>new.sender_id and not public.social_blocked(new.sender_id,d.user_id)
 and not exists(select 1 from public.room_preferences pref where pref.room_id=new.room_id and pref.user_id=d.user_id and pref.muted)
 and not coalesce(d.active_room=new.room_id and d.active_until>now(),false) on conflict do nothing;
 return new;
end $$;
commit;
