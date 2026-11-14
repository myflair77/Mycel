begin;
create table public.friendships (
 low_id uuid not null references public.profiles(id), high_id uuid not null references public.profiles(id),
 requested_by uuid not null references public.profiles(id), status text not null check(status in ('pending','accepted','rejected')),
 updated_at timestamptz not null default now(), primary key(low_id,high_id),
 check(low_id<high_id),check(requested_by in (low_id,high_id))
);
create table public.user_blocks (blocker uuid not null references public.profiles(id), blocked uuid not null references public.profiles(id),primary key(blocker,blocked),check(blocker<>blocked));
create table public.social_limits (user_id uuid not null references public.profiles(id),action text not null,window_start timestamptz not null,hits integer not null,primary key(user_id,action));
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.social_limits enable row level security;
revoke all on public.friendships,public.user_blocks,public.social_limits from anon,authenticated;
-- Data is available only through scoped RPCs; no unrestricted directory or block list.
create function public.social_quota(p_action text,p_max integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 insert into public.social_limits as l(user_id,action,window_start,hits) values(actor,p_action,clock_timestamp(),1)
 on conflict(user_id,action) do update set
 hits=case when l.window_start<=clock_timestamp()-make_interval(secs=>p_seconds) then 1 else least(l.hits+1,p_max+1) end,
 window_start=case when l.window_start<=clock_timestamp()-make_interval(secs=>p_seconds) then clock_timestamp() else l.window_start end
 returning hits into n;
 return n<=p_max;
end $$;
create function public.social_pair_lock(p_a uuid,p_b uuid) returns void
language sql security definer set search_path='' as $$
 select pg_advisory_xact_lock(hashtextextended('social:'||least(p_a,p_b)::text||':'||greatest(p_a,p_b)::text,0));
$$;
create function public.social_blocked(p_a uuid,p_b uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_blocks where (blocker=p_a and blocked=p_b) or (blocker=p_b and blocked=p_a));
$$;
create function public.search_friend(p_username text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); person public.profiles;
begin
 if not public.social_quota('search',20,60) then return jsonb_build_object('error','검색은 1분에 20회까지 가능합니다. 잠시 후 다시 시도해 주세요.'); end if;
 select * into person from public.profiles where username=lower(trim(ltrim(p_username,'@'))) and id<>actor;
 if not found or public.social_blocked(actor,person.id) then return jsonb_build_object('error','사용자를 찾을 수 없습니다.'); end if;
 return jsonb_build_object('user',jsonb_build_object('id',person.id,'username',person.username,'display_name',person.display_name));
end $$;
create function public.request_friend(p_peer uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); f public.friendships;
begin
 -- Return errors instead of raising so failed lookups/requests also consume quota.
 if not public.social_quota('request',10,3600) then return jsonb_build_object('error','친구 요청은 1시간에 10회까지 가능합니다.'); end if;
 if p_peer is null or p_peer=actor or not exists(select 1 from public.profiles where id=p_peer) then return jsonb_build_object('error','요청할 수 없는 사용자입니다.'); end if;
 perform public.social_pair_lock(actor,p_peer);
 if public.social_blocked(actor,p_peer) then return jsonb_build_object('error','친구 요청을 보낼 수 없습니다.'); end if;
 select * into f from public.friendships where low_id=least(actor,p_peer) and high_id=greatest(actor,p_peer);
 if found then
  if f.status='accepted' then return jsonb_build_object('error','이미 친구입니다.'); end if;
  if f.status='pending' then return jsonb_build_object('error','이미 대기 중인 요청이 있습니다. 받은 요청을 확인해 주세요.'); end if;
  if f.updated_at>now()-interval '24 hours' then return jsonb_build_object('error','거절되거나 종료된 요청은 24시간 후 다시 보낼 수 있습니다.'); end if;
 end if;
 insert into public.friendships(low_id,high_id,requested_by,status) values(least(actor,p_peer),greatest(actor,p_peer),actor,'pending')
 on conflict(low_id,high_id) do update set requested_by=actor,status='pending',updated_at=now();
 return jsonb_build_object('ok',true);
end $$;
create function public.respond_friend(p_peer uuid,p_accept boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform public.social_pair_lock(actor,p_peer);
 if public.social_blocked(actor,p_peer) then return jsonb_build_object('error','처리할 수 없는 요청입니다.'); end if;
 update public.friendships set status=case when p_accept then 'accepted' else 'rejected' end,updated_at=now()
 where low_id=least(actor,p_peer) and high_id=greatest(actor,p_peer) and requested_by=p_peer and status='pending';
 if not found then return jsonb_build_object('error','받은 요청이 없거나 이미 처리되었습니다.'); end if;
 return jsonb_build_object('ok',true);
end $$;
create function public.set_user_block(p_peer uuid,p_block boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_peer is null or p_peer=actor or not exists(select 1 from public.profiles where id=p_peer) then return jsonb_build_object('error','처리할 수 없는 사용자입니다.'); end if;
 perform public.social_pair_lock(actor,p_peer);
 if p_block then
  insert into public.user_blocks values(actor,p_peer) on conflict do nothing;
  update public.friendships set status='rejected',updated_at=now() where low_id=least(actor,p_peer) and high_id=greatest(actor,p_peer);
 else delete from public.user_blocks where blocker=actor and blocked=p_peer;
 end if;
 return jsonb_build_object('ok',true);
end $$;
create function public.list_social() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'status',f.status,'incoming',f.requested_by<>actor)), '[]'::jsonb) into result
 from public.friendships f join public.profiles p on p.id=case when f.low_id=actor then f.high_id else f.low_id end
 where actor in(f.low_id,f.high_id) and f.status in ('pending','accepted') and not public.social_blocked(actor,p.id);
 return jsonb_build_object('relations',result,'blocks',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name)),'[]'::jsonb) from public.user_blocks b join public.profiles p on p.id=b.blocked where b.blocker=actor));
end $$;
create or replace function public.open_direct_chat(p_username text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); peer uuid; pair text; room uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select id into peer from public.profiles where username=lower(trim(ltrim(p_username,'@')));
 if peer is null or peer=actor then raise exception '대화를 시작할 수 없습니다. 친구 목록을 확인해 주세요.'; end if;
 perform public.social_pair_lock(actor,peer);
 if public.social_blocked(actor,peer) then raise exception '차단 상태에서는 새 메시지를 주고받을 수 없습니다.'; end if;
 pair:=least(actor::text,peer::text)||':'||greatest(actor::text,peer::text);
 select id into room from public.chat_rooms where direct_key=pair;
 -- Existing conversations remain usable, but never create new ones before acceptance.
 if room is not null then return room; end if;
 if not exists(select 1 from public.friendships where low_id=least(actor,peer) and high_id=greatest(actor,peer) and status='accepted') then raise exception '대화를 시작할 수 없습니다. 친구 목록을 확인해 주세요.'; end if;
 insert into public.chat_rooms(direct_key) values(pair) returning id into room;
 insert into public.chat_members(room_id,user_id) values(room,actor),(room,peer);
 return room;
end $$;

create or replace function public.send_message(p_room uuid,p_body text,p_key uuid) returns public.messages
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); saved public.messages; next_seq bigint; peer uuid;
begin
 if actor is null or not public.is_room_member(p_room) then
  raise exception 'Room access denied' using errcode='42501';
 end if;
 if p_key is null or p_body is null or char_length(trim(p_body)) not between 1 and 4000 then
  raise exception 'Invalid message';
 end if;
 -- Serialize writes for each sender and room, so retry and quota checks are atomic.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select user_id into peer from public.chat_members where room_id=p_room and user_id<>actor;
 perform public.social_pair_lock(actor,peer);
 if public.social_blocked(actor,peer) then raise exception '차단 상태에서는 새 메시지를 주고받을 수 없습니다.' using errcode='42501'; end if;
 perform 1 from public.chat_rooms where id=p_room for update;
 select * into saved from public.messages where sender_id=actor and idempotency_key=p_key;
 if found then
  if saved.room_id<>p_room or saved.body<>trim(p_body) then raise exception 'Idempotency conflict'; end if;
  return saved;
 end if;
 if (select count(*) from public.messages where sender_id=actor and created_at>now()-interval '1 minute')>=60 then
  raise exception 'Message rate limit';
 end if;
 update public.chat_rooms set last_sequence=last_sequence+1 where id=p_room returning last_sequence into next_seq;
 insert into public.messages(room_id,sender_id,body,idempotency_key,sequence)
 values(p_room,actor,trim(p_body),p_key,next_seq) returning * into saved;
 return saved;
end $$;

revoke all on function public.social_quota(text,integer,integer),public.social_pair_lock(uuid,uuid),public.social_blocked(uuid,uuid) from public,anon,authenticated;
revoke all on function public.search_friend(text),public.request_friend(uuid),public.respond_friend(uuid,boolean),public.set_user_block(uuid,boolean),public.list_social() from public,anon;
grant execute on function public.search_friend(text),public.request_friend(uuid),public.respond_friend(uuid,boolean),public.set_user_block(uuid,boolean),public.list_social() to authenticated;
commit;
