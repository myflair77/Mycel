begin;
alter table public.chat_rooms add column group_name text check(char_length(group_name) between 1 and 60), add column group_creator uuid references public.profiles(id);
alter table public.chat_members add column joined_sequence bigint not null default 0;
create function public.invite_group_members(p_room uuid,p_users uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; seq bigint; ids uuid[];
begin
 perform 1 from public.chat_rooms where id=p_room and group_name is not null for update;
 if not found or actor is null or not public.is_room_member(p_room) then raise exception '그룹 접근 권한이 없습니다.';end if;
 select array_agg(distinct x) into ids from unnest(p_users) x where x is not null and x<>actor;
 if coalesce(cardinality(ids),0) not between 1 and 49 then raise exception '초대할 친구를 선택해 주세요.';end if;
 if (select count(*) from public.chat_members where room_id=p_room)+(select count(*) from unnest(ids) x where not exists(select 1 from public.chat_members where room_id=p_room and user_id=x))>50 then raise exception '그룹은 최대 50명입니다.';end if;
 if not public.social_quota('group_invite',30,3600) then raise exception '초대 횟수 제한입니다. 잠시 후 다시 시도해 주세요.';end if;
 select last_sequence into seq from public.chat_rooms where id=p_room;
 foreach target in array ids loop
  if exists(select 1 from public.chat_members where room_id=p_room and user_id=target) then continue;end if;
  if not exists(select 1 from public.friendships where low_id=least(actor,target) and high_id=greatest(actor,target) and status='accepted') then raise exception '현재 친구만 초대할 수 있습니다.';end if;
  if exists(select 1 from public.chat_members where room_id=p_room and public.social_blocked(user_id,target)) then raise exception '차단 관계가 있는 참여자는 초대할 수 없습니다.';end if;
  insert into public.chat_members(room_id,user_id,joined_sequence) values(p_room,target,seq);
  insert into public.chat_reads(room_id,user_id,last_read_sequence) values(p_room,target,seq);
 end loop;
end $$;
create function public.create_group_chat(p_key uuid,p_name text,p_users uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); room uuid;
begin
 if actor is null or p_key is null or p_name is null or char_length(trim(p_name)) not between 1 and 60 then raise exception '그룹 이름을 1~60자로 입력해 주세요.';end if;
 perform pg_advisory_xact_lock(hashtextextended('group:'||actor::text,0));
 select id into room from public.chat_rooms where direct_key='group:'||p_key::text and group_creator=actor;
 if found then
  if not public.is_room_member(room) then raise exception '이미 나간 그룹입니다.';end if;
  return room;
 end if;
 if not public.social_quota('group_create',10,3600) then raise exception '그룹 생성 횟수 제한입니다.';end if;
 insert into public.chat_rooms(direct_key,group_name,group_creator) values('group:'||p_key::text,trim(p_name),actor) returning id into room;
 insert into public.chat_members(room_id,user_id) values(room,actor);
 perform public.invite_group_members(room,p_users);
 return room;
end $$;
create function public.rename_group_chat(p_room uuid,p_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.chat_rooms where id=p_room and group_name is not null for update;
 if not found or auth.uid() is null or not public.is_room_member(p_room) then raise exception '그룹 접근 권한이 없습니다.';end if;
 if p_name is null or char_length(trim(p_name)) not between 1 and 60 then raise exception '그룹 이름은 1~60자입니다.';end if;
 update public.chat_rooms set group_name=trim(p_name) where id=p_room;
end $$;
create function public.leave_group_chat(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.chat_rooms where id=p_room and group_name is not null for update;
 if not found or auth.uid() is null or not public.is_room_member(p_room) then raise exception '그룹 접근 권한이 없습니다.';end if;
 update public.push_jobs j set status='skipped' from public.push_devices d,public.messages m where j.device_id=d.id and j.message_id=m.id and d.user_id=auth.uid() and m.room_id=p_room and j.status='pending';
 delete from public.chat_reads where room_id=p_room and user_id=auth.uid();
 delete from public.room_preferences where room_id=p_room and user_id=auth.uid();
 delete from public.chat_members where room_id=p_room and user_id=auth.uid();
end $$;
create function public.get_group_state(p_room uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_room_member(p_room) then raise exception '그룹 접근 권한이 없습니다.';end if;
 return jsonb_build_object('members',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,'joined_sequence',m.joined_sequence,'read_sequence',coalesce(r.last_read_sequence,0)) order by p.display_name),'[]') from public.chat_members m join public.profiles p on p.id=m.user_id left join public.chat_reads r on r.room_id=m.room_id and r.user_id=m.user_id where m.room_id=p_room),
 'authors',(select coalesce(jsonb_object_agg(p.id,p.display_name),'{}') from public.profiles p where exists(select 1 from public.messages m where m.room_id=p_room and m.sender_id=p.id)));
end $$;
create or replace function public.get_conversations() returns table(id uuid,direct_key text,peer jsonb,last_body text,last_at timestamptz,muted boolean)
language sql stable security definer set search_path='' as $$
 select r.id,r.direct_key,case when r.group_name is not null then jsonb_build_object('id',r.id,'username','','display_name',r.group_name,'member_count',(select count(*) from public.chat_members where room_id=r.id)) when r.self_owner=auth.uid() then jsonb_build_object('id',r.self_owner,'username','','display_name','나와의 대화') else jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name) end,
 case when last.attachment_id is not null then '📎 '||left(last.body,160) else left(last.body,160) end,last.created_at,coalesce(pref.muted,false)
 from public.chat_rooms r join public.chat_members mine on mine.room_id=r.id and mine.user_id=auth.uid()
 left join lateral (select p.* from public.chat_members other join public.profiles p on p.id=other.user_id where other.room_id=r.id and other.user_id<>auth.uid() and r.group_name is null limit 1) p on true
 left join public.room_preferences pref on pref.room_id=r.id and pref.user_id=auth.uid()
 left join lateral (select m.body,m.created_at,m.attachment_id from public.messages m where m.room_id=r.id order by m.sequence desc limit 1) last on true
 order by coalesce(last.created_at,r.created_at) desc,r.id;
$$;
-- Lock membership against concurrent sends/leaves; apply block checks to every recipient.
create function public.guard_group_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.chat_rooms where id=new.room_id and group_name is not null) then
  perform 1 from public.chat_rooms where id=new.room_id for update;
  if not exists(select 1 from public.chat_members where room_id=new.room_id and user_id=new.sender_id) then raise exception '그룹 참여자만 전송할 수 있습니다.';end if;
  if exists(select 1 from public.chat_members where room_id=new.room_id and user_id<>new.sender_id and public.social_blocked(user_id,new.sender_id)) then raise exception '차단 관계가 있어 전송할 수 없습니다.';end if;
 end if;
 return new;
end $$;
create trigger guard_group_message before insert on public.messages for each row execute function public.guard_group_message();
revoke all on function public.guard_group_message() from public,anon,authenticated;
revoke all on function public.create_group_chat(uuid,text,uuid[]),public.invite_group_members(uuid,uuid[]),public.rename_group_chat(uuid,text),public.leave_group_chat(uuid),public.get_group_state(uuid) from public,anon;
grant execute on function public.create_group_chat(uuid,text,uuid[]),public.invite_group_members(uuid,uuid[]),public.rename_group_chat(uuid,text),public.leave_group_chat(uuid),public.get_group_state(uuid) to authenticated;
commit;
