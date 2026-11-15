begin;
alter table public.chat_rooms
 add column group_mode text not null default 'regular' check(group_mode in ('regular','team')),
 add column owner_id uuid references public.profiles(id),
 add column invite_policy text not null default 'managers' check(invite_policy in ('managers','all')),
 add column membership_version bigint not null default 0,
 add column policy_version bigint not null default 0,
 add column owner_candidate uuid references public.profiles(id),
 add column owner_offer_expires timestamptz;
alter table public.chat_members add column group_role text not null default 'member' check(group_role in ('member','admin'));
create table public.room_mode_proposals(
 id uuid primary key,room_id uuid not null references public.chat_rooms(id),proposer uuid not null references public.profiles(id),
 target_mode text not null check(target_mode in ('regular','team')),candidate uuid references public.profiles(id),
 invite_policy text not null check(invite_policy in ('managers','all')),membership_version bigint not null,policy_version bigint not null,
 voters uuid[] not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '72 hours',
 status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled','expired','invalidated')),
 finished_at timestamptz);
create unique index one_pending_room_mode on public.room_mode_proposals(room_id) where status='pending';
create table public.room_mode_votes(proposal_id uuid references public.room_mode_proposals(id),user_id uuid references public.profiles(id),agree boolean not null,owner_accept boolean not null default false,created_at timestamptz not null default now(),primary key(proposal_id,user_id));
create table public.room_events(id bigint generated always as identity primary key,room_id uuid not null references public.chat_rooms(id),actor uuid references public.profiles(id),body text not null,history_sequence bigint not null,created_at timestamptz not null default now());
alter table public.room_mode_proposals enable row level security;
alter table public.room_mode_votes enable row level security;
alter table public.room_events enable row level security;
revoke all on public.room_mode_proposals,public.room_mode_votes,public.room_events from public,anon,authenticated;

create function public.group_manager(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chat_rooms r join public.chat_members m on m.room_id=r.id and m.user_id=auth.uid() where r.id=p_room and (r.group_mode='regular' or r.owner_id=auth.uid() or m.group_role='admin'));
$$;
create function public.group_event(p_room uuid,p_body text) returns void language sql security definer set search_path='' as $$
 insert into public.room_events(room_id,actor,body,history_sequence) select id,auth.uid(),p_body,last_sequence+1 from public.chat_rooms where id=p_room;
$$;
create function public.expire_group_vote(p_room uuid) returns void language sql security definer set search_path='' as $$
 update public.room_mode_proposals set status='expired',finished_at=now() where room_id=p_room and status='pending' and expires_at<=now();
$$;
create function public.group_membership_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 rid:=case when tg_op='DELETE' then old.room_id else new.room_id end;
 update public.chat_rooms set membership_version=membership_version+1,owner_candidate=null,owner_offer_expires=null where id=rid;
 update public.room_mode_proposals set status=case when expires_at<=now() then 'expired' else 'invalidated' end,finished_at=now() where room_id=rid and status='pending';
 return null;
end $$;
create trigger group_membership_changed after insert or delete on public.chat_members for each row execute function public.group_membership_changed();

-- Preserve legacy entrypoints, but enforce new authorization through wrappers.
alter function public.invite_group_members(uuid,uuid[]) rename to invite_group_members_base;
create function public.invite_group_members(p_room uuid,p_users uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.chat_rooms where id=p_room for update;
 if exists(select 1 from public.chat_rooms where id=p_room and group_mode='team' and invite_policy='managers') and not public.group_manager(p_room) then raise exception '방장과 관리자만 초대할 수 있습니다.';end if;
 perform public.invite_group_members_base(p_room,p_users);
end $$;
alter function public.rename_group_chat(uuid,text) rename to rename_group_chat_base;
create function public.rename_group_chat(p_room uuid,p_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.chat_rooms where id=p_room for update;
 if not public.group_manager(p_room) then raise exception '방장과 관리자만 방 이름을 변경할 수 있습니다.';end if;
 perform public.rename_group_chat_base(p_room,p_name);
end $$;
alter function public.leave_group_chat(uuid) rename to leave_group_chat_base;
create function public.leave_group_chat(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.chat_rooms where id=p_room for update;
 if exists(select 1 from public.chat_rooms where id=p_room and group_mode='team' and owner_id=auth.uid()) and (select count(*) from public.chat_members where room_id=p_room)>1 then raise exception '방장을 넘기고 상대가 수락한 뒤 나갈 수 있습니다.';end if;
 perform public.leave_group_chat_base(p_room);
end $$;

create function public.create_group_with_mode(p_key uuid,p_name text,p_users uuid[],p_mode text,p_direct uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if auth.uid() is null or p_mode is null or p_mode not in ('regular','team') then raise exception '방 종류를 선택해 주세요.';end if;
 perform pg_advisory_xact_lock(hashtextextended('group:'||auth.uid()::text,0));
 select id into rid from public.chat_rooms where direct_key='group:'||p_key::text and group_creator=auth.uid();
 if found then
  if not public.is_room_member(rid) then raise exception '이미 나간 그룹입니다.';end if;
  return rid; -- Never reapply a creation mode to an existing room.
 end if;
 if p_direct is null then rid:=public.create_group_chat(p_key,p_name,p_users);
 else rid:=public.create_group_from_direct(p_direct,p_key,p_name,p_users);end if;
 update public.chat_rooms set group_mode=p_mode,owner_id=case when p_mode='team' then auth.uid() else null end where id=rid;
 perform public.group_event(rid,case when p_mode='team' then '팀채팅이 만들어졌습니다.' else '일반 그룹채팅이 만들어졌습니다.' end);
 return rid;
end $$;

create function public.propose_group_mode(p_room uuid,p_id uuid,p_mode text,p_candidate uuid,p_policy text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.chat_rooms;ids uuid[];
begin
 select * into r from public.chat_rooms where id=p_room for update;
 if auth.uid() is null or r.group_name is null or not public.is_room_member(p_room) then raise exception '그룹 접근 권한이 없습니다.';end if;
 if exists(select 1 from public.room_mode_proposals where id=p_id and room_id=p_room and proposer=auth.uid()) then return p_id;end if;
 if p_id is null or p_mode is null or p_mode not in ('regular','team') or p_mode=r.group_mode or p_policy is null or p_policy not in ('managers','all') then raise exception '변경할 종류와 초대 권한을 확인해 주세요.';end if;
 perform public.expire_group_vote(p_room);
 if exists(select 1 from public.room_mode_proposals where room_id=p_room and status='pending') then raise exception '이미 진행 중인 전환 제안이 있습니다.';end if;
 if exists(select 1 from public.room_mode_proposals where room_id=p_room and status='rejected' and finished_at>now()-interval '24 hours') then raise exception '거절된 제안은 24시간 뒤 다시 제안할 수 있습니다.';end if;
 if (select count(*) from public.room_mode_proposals where room_id=p_room and created_at>now()-interval '24 hours')>=3 then raise exception '종류 변경 제안은 하루 3회까지 가능합니다.';end if;
 if p_mode='team' and (p_candidate is null or not exists(select 1 from public.chat_members where room_id=p_room and user_id=p_candidate)) then raise exception '현재 참여자 중 방장 후보를 선택해 주세요.';end if;
 select array_agg(user_id order by user_id) into ids from public.chat_members where room_id=p_room;
 insert into public.room_mode_proposals(id,room_id,proposer,target_mode,candidate,invite_policy,membership_version,policy_version,voters)
 values(p_id,p_room,auth.uid(),p_mode,case when p_mode='team' then p_candidate else null end,p_policy,r.membership_version,r.policy_version,ids);
 perform public.group_event(p_room,'방 종류 변경 제안이 등록되었습니다. 72시간 내 참여자 전원의 동의가 필요합니다.');
 return p_id;
end $$;

create function public.vote_group_mode(p_id uuid,p_agree boolean,p_accept_owner boolean default false) returns text language plpgsql security definer set search_path='' as $$
declare p public.room_mode_proposals;r public.chat_rooms;rid uuid;ids uuid[];
begin
 select room_id into rid from public.room_mode_proposals where id=p_id;
 select * into r from public.chat_rooms where id=rid for update;
 select * into p from public.room_mode_proposals where id=p_id for update;
 if auth.uid() is null or not public.is_room_member(rid) or not(auth.uid()=any(p.voters)) then raise exception '투표 권한이 없습니다.';end if;
 perform public.expire_group_vote(rid);select * into p from public.room_mode_proposals where id=p_id;
 if p.status<>'pending' then return p.status;end if;
 select array_agg(user_id order by user_id) into ids from public.chat_members where room_id=rid;
 if ids is distinct from p.voters or r.membership_version<>p.membership_version or r.policy_version<>p.policy_version then
  update public.room_mode_proposals set status='invalidated',finished_at=now() where id=p_id;return 'invalidated';
 end if;
 if p_agree is null or p_accept_owner is null then raise exception '동의 여부를 선택해 주세요.';end if;
 if p_agree and p.candidate=auth.uid() and not p_accept_owner then raise exception '방장 역할 수락을 확인해 주세요.';end if;
 if exists(select 1 from public.room_mode_votes where proposal_id=p_id and user_id=auth.uid()) then return 'pending';end if;
 insert into public.room_mode_votes(proposal_id,user_id,agree,owner_accept) values(p_id,auth.uid(),p_agree,p_accept_owner);
 if not p_agree then
  update public.room_mode_proposals set status='rejected',finished_at=now() where id=p_id;
  perform public.group_event(rid,'전원 동의가 이루어지지 않아 방 종류 변경 제안이 종료되었습니다.');return 'rejected';
 end if;
 if (select count(*) from public.room_mode_votes where proposal_id=p_id and agree)=cardinality(p.voters) then
  if p.target_mode='team' and not exists(select 1 from public.room_mode_votes where proposal_id=p_id and user_id=p.candidate and agree and owner_accept) then raise exception '방장 수락이 필요합니다.';end if;
  update public.room_mode_proposals set status='accepted',finished_at=now() where id=p_id;
  update public.chat_rooms set group_mode=p.target_mode,owner_id=case when p.target_mode='team' then p.candidate else null end,invite_policy=p.invite_policy,policy_version=policy_version+1,owner_candidate=null,owner_offer_expires=null where id=rid;
  update public.chat_members set group_role='member' where room_id=rid;
  perform public.group_event(rid,case when p.target_mode='team' then '전원 동의로 팀채팅으로 전환되었습니다.' else '전원 동의로 일반 그룹채팅으로 전환되었습니다.' end||' 기존 대화·파일과 공개 범위는 유지됩니다.');
  return 'accepted';
 end if;
 return 'pending';
end $$;
create function public.cancel_group_mode(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 select room_id into rid from public.room_mode_proposals where id=p_id;
 perform 1 from public.chat_rooms where id=rid for update;
 if auth.uid() is null or not public.is_room_member(rid) then raise exception '그룹 접근 권한이 없습니다.';end if;
 update public.room_mode_proposals set status='cancelled',finished_at=now() where id=p_id and proposer=auth.uid() and status='pending';
 if not found then raise exception '진행 중인 본인 제안만 취소할 수 있습니다.';end if;
end $$;

create function public.manage_team(p_room uuid,p_action text,p_user uuid default null,p_value text default null) returns void language plpgsql security definer set search_path='' as $$
declare r public.chat_rooms;actor_role text;target_role text;
begin
 select * into r from public.chat_rooms where id=p_room for update;
 if auth.uid() is null or r.group_mode<>'team' or not public.is_room_member(p_room) then raise exception '팀채팅 접근 권한이 없습니다.';end if;
 perform public.expire_group_vote(p_room);
 if p_action<>'policy' and exists(select 1 from public.room_mode_proposals where room_id=p_room and status='pending') then raise exception '전환 투표 중에는 참여자 내보내기·역할 변경을 할 수 없습니다.';end if;
 select group_role into actor_role from public.chat_members where room_id=p_room and user_id=auth.uid();
 select group_role into target_role from public.chat_members where room_id=p_room and user_id=p_user;
 if p_action='accept_owner' then
  if r.owner_candidate is distinct from auth.uid() or r.owner_offer_expires<=now() then raise exception '유효한 방장 위임 제안이 없습니다.';end if;
  update public.chat_rooms set owner_id=auth.uid(),owner_candidate=null,owner_offer_expires=null,policy_version=policy_version+1 where id=p_room;
  perform public.group_event(p_room,'새 방장이 위임을 수락했습니다.');return;
 end if;
 if p_action='kick' then
  if p_user is null or p_user=auth.uid() or p_user=r.owner_id or target_role is null or (r.owner_id<>auth.uid() and (actor_role<>'admin' or target_role='admin')) then raise exception '해당 참여자를 내보낼 권한이 없습니다.';end if;
  update public.push_jobs j set status='skipped' from public.push_devices d,public.messages m where j.device_id=d.id and j.message_id=m.id and d.user_id=p_user and m.room_id=p_room and j.status='pending';
  delete from public.chat_reads where room_id=p_room and user_id=p_user;
  delete from public.room_preferences where room_id=p_room and user_id=p_user;
  delete from public.chat_members where room_id=p_room and user_id=p_user;
  perform public.group_event(p_room,'관리자가 참여자 한 명을 내보냈습니다.');return;
 end if;
 if r.owner_id is distinct from auth.uid() then raise exception '방장만 변경할 수 있습니다.';end if;
 if p_action='role' then
  if target_role is null or p_user=r.owner_id or p_value is null or p_value not in ('member','admin') then raise exception '역할을 확인해 주세요.';end if;
  update public.chat_members set group_role=p_value where room_id=p_room and user_id=p_user;
  perform public.group_event(p_room,'참여자의 관리자 권한이 변경되었습니다.');
 elsif p_action='offer_owner' then
  if target_role is null or p_user=r.owner_id then raise exception '다른 참여자를 선택해 주세요.';end if;
  update public.chat_rooms set owner_candidate=p_user,owner_offer_expires=now()+interval '72 hours' where id=p_room;
  perform public.group_event(p_room,'방장 위임을 제안했습니다. 상대의 수락 전까지 현재 방장이 유지됩니다.');
 elsif p_action='cancel_owner' then
  update public.chat_rooms set owner_candidate=null,owner_offer_expires=null where id=p_room;
 elsif p_action='policy' then
  if p_value is null or p_value not in ('all','managers') then raise exception '초대 권한을 확인해 주세요.';end if;
  update public.chat_rooms set invite_policy=p_value where id=p_room;
  update public.room_mode_proposals set status='invalidated',finished_at=now() where room_id=p_room and status='pending';
  perform public.group_event(p_room,'팀채팅 초대 권한이 변경되었습니다.');
 else raise exception '지원하지 않는 관리 작업입니다.';
 end if;
 update public.chat_rooms set policy_version=policy_version+1 where id=p_room;
end $$;

-- Notice permissions also cover callers of the existing post RPC.
create function public.guard_team_notice() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.chat_rooms where id=new.room_id for update;
 if (tg_op='INSERT' and new.notice) or (tg_op='UPDATE' and new.notice is distinct from old.notice) then
  if exists(select 1 from public.chat_rooms where id=new.room_id and group_mode='team') and not public.group_manager(new.room_id) then raise exception '방장과 관리자만 공지를 지정하거나 해제할 수 있습니다.';end if;
 end if;
 return new;
end $$;
create trigger guard_team_notice before insert or update on public.room_posts for each row execute function public.guard_team_notice();
create function public.set_team_notice(p_id uuid,p_value boolean) returns void language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 select room_id into rid from public.room_posts where id=p_id;
 perform 1 from public.chat_rooms where id=rid for update;
 if p_value is null or not public.group_manager(rid) or not public.can_read_room_post(p_id) then raise exception '공지 변경 권한이 없습니다.';end if;
 update public.room_posts set notice=p_value,updated_at=clock_timestamp() where id=p_id and deleted_at is null;
end $$;

alter function public.get_group_state(uuid) rename to get_group_state_base;
create function public.get_group_state(p_room uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.chat_rooms;p public.room_mode_proposals;result jsonb;
begin
 result:=public.get_group_state_base(p_room);
 select * into r from public.chat_rooms where id=p_room;
 select * into p from public.room_mode_proposals where room_id=p_room order by created_at desc,id limit 1;
 return result||jsonb_build_object('mode',r.group_mode,'owner_id',r.owner_id,'invite_policy',r.invite_policy,
 'owner_candidate',case when r.owner_offer_expires>now() then r.owner_candidate else null end,'owner_offer_expires',r.owner_offer_expires,
 'roles',(select coalesce(jsonb_object_agg(user_id,group_role),'{}') from public.chat_members where room_id=p_room),
 'proposal',case when p.id is null then null else jsonb_build_object('id',p.id,'proposer',p.proposer,'target_mode',p.target_mode,'candidate',p.candidate,'invite_policy',p.invite_policy,'status',case when p.status='pending' and p.expires_at<=now() then 'expired' else p.status end,'expires_at',p.expires_at,'total',cardinality(p.voters),'agreed',(select count(*) from public.room_mode_votes where proposal_id=p.id and agree),'my_vote',(select agree from public.room_mode_votes where proposal_id=p.id and user_id=auth.uid())) end,
 'events',(select coalesce(jsonb_agg(e order by e.id desc),'[]') from (select id,body,created_at from public.room_events where room_id=p_room and public.can_read_chat_sequence(room_id,history_sequence) order by id desc limit 10) e));
end $$;

revoke all on function public.invite_group_members_base(uuid,uuid[]),public.rename_group_chat_base(uuid,text),public.leave_group_chat_base(uuid),public.get_group_state_base(uuid) from public,anon,authenticated;
revoke all on function public.group_manager(uuid),public.group_event(uuid,text),public.expire_group_vote(uuid),public.group_membership_changed(),public.guard_team_notice() from public,anon,authenticated;
revoke all on function public.invite_group_members(uuid,uuid[]),public.rename_group_chat(uuid,text),public.leave_group_chat(uuid),public.get_group_state(uuid),public.create_group_with_mode(uuid,text,uuid[],text,uuid),public.propose_group_mode(uuid,uuid,text,uuid,text),public.vote_group_mode(uuid,boolean,boolean),public.cancel_group_mode(uuid),public.manage_team(uuid,text,uuid,text),public.set_team_notice(uuid,boolean) from public,anon;
grant execute on function public.invite_group_members(uuid,uuid[]),public.rename_group_chat(uuid,text),public.leave_group_chat(uuid),public.get_group_state(uuid),public.create_group_with_mode(uuid,text,uuid[],text,uuid),public.propose_group_mode(uuid,uuid,text,uuid,text),public.vote_group_mode(uuid,boolean,boolean),public.cancel_group_mode(uuid),public.manage_team(uuid,text,uuid,text),public.set_team_notice(uuid,boolean) to authenticated;
commit;
