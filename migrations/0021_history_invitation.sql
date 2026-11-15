begin;
-- Per-invitation consent; no room-wide grant and no changes to existing members.
create table public.room_history_proposals(
 id uuid primary key,room_id uuid not null references public.chat_rooms(id),proposer uuid not null references public.profiles(id),
 targets uuid[] not null,voters uuid[] not null,membership_version bigint not null,policy_version bigint not null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '72 hours',
 status text not null default 'pending' check(status in ('pending','approved','accepted','rejected','cancelled','expired','invalidated')));
create unique index one_history_invitation on public.room_history_proposals(room_id) where status in ('pending','approved');
create table public.room_history_votes(proposal_id uuid references public.room_history_proposals(id),user_id uuid references public.profiles(id),agree boolean not null,primary key(proposal_id,user_id));
alter table public.room_history_proposals enable row level security;
alter table public.room_history_votes enable row level security;
revoke all on public.room_history_proposals,public.room_history_votes from public,anon,authenticated;

create function public.invalidate_history_invitation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.room_history_proposals set status=case when expires_at<=now() then 'expired' else 'invalidated' end where room_id=new.id and status in ('pending','approved');
 return null;
end $$;
create trigger invalidate_history_invitation after update of membership_version,policy_version,owner_id,group_mode on public.chat_rooms for each row
 when(old.membership_version is distinct from new.membership_version or old.policy_version is distinct from new.policy_version or old.owner_id is distinct from new.owner_id or old.group_mode is distinct from new.group_mode)
 execute function public.invalidate_history_invitation();

create function public.propose_history_invitation(p_room uuid,p_id uuid,p_users uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.chat_rooms;ids uuid[];voters uuid[];target uuid;prior public.room_history_proposals;
begin
 select * into r from public.chat_rooms where id=p_room for update;
 if auth.uid() is null or r.group_mode is distinct from 'team' or r.owner_id is distinct from auth.uid() or not public.is_room_member(p_room) then raise exception '팀채팅 방장만 이전 기록 공개 초대를 제안할 수 있습니다.';end if;
 select array_agg(distinct x order by x) into ids from unnest(p_users) x where x is not null;
 if p_id is null or coalesce(cardinality(ids),0) not between 1 and 49 then raise exception '초대할 친구를 선택해 주세요.';end if;
 select * into prior from public.room_history_proposals where id=p_id;
 if found then
  if prior.room_id=p_room and prior.proposer=auth.uid() and prior.targets=ids then return p_id;end if;
  raise exception 'Idempotency conflict';
 end if;
 update public.room_history_proposals set status='expired' where room_id=p_room and status in ('pending','approved') and expires_at<=now();
 if exists(select 1 from public.room_history_proposals where room_id=p_room and status in ('pending','approved')) then raise exception '진행 중인 이전 기록 공개 제안이 있습니다.';end if;
 if exists(select 1 from public.room_mode_proposals where room_id=p_room and status='pending' and expires_at>now()) then raise exception '방 종류 전환 투표가 끝난 뒤 제안해 주세요.';end if;
 if exists(select 1 from public.room_history_proposals where room_id=p_room and status='rejected' and created_at>now()-interval '24 hours') then raise exception '거절된 공개 제안은 24시간 뒤 다시 제안할 수 있습니다.';end if;
 if (select count(*) from public.room_history_proposals where room_id=p_room and created_at>now()-interval '24 hours')>=3 then raise exception '공개 제안은 하루 3회까지 가능합니다.';end if;
 select array_agg(user_id order by user_id) into voters from public.chat_members where room_id=p_room;
 if cardinality(voters)+cardinality(ids)>50 then raise exception '그룹은 최대 50명입니다.';end if;
 foreach target in array ids loop
  if target=any(voters) then raise exception '현재 참여자는 초대 대상이 될 수 없습니다.';end if;
  if not exists(select 1 from public.friendships where low_id=least(auth.uid(),target) and high_id=greatest(auth.uid(),target) and status='accepted') then raise exception '현재 친구만 초대할 수 있습니다.';end if;
  if exists(select 1 from public.chat_members where room_id=p_room and public.social_blocked(user_id,target)) then raise exception '차단 관계가 있는 참여자는 초대할 수 없습니다.';end if;
 end loop;
 insert into public.room_history_proposals(id,room_id,proposer,targets,voters,membership_version,policy_version) values(p_id,p_room,auth.uid(),ids,voters,r.membership_version,r.policy_version);
 perform public.group_event(p_room,'방장이 이전 기록 공개 초대를 제안했습니다. 지정된 초대 대상에 대해 기존 참여자 전원의 동의가 필요합니다.');
 return p_id;
end $$;

create function public.vote_history_invitation(p_id uuid,p_agree boolean) returns text language plpgsql security definer set search_path='' as $$
declare p public.room_history_proposals;r public.chat_rooms;rid uuid;ids uuid[];
begin
 select room_id into rid from public.room_history_proposals where id=p_id;
 select * into r from public.chat_rooms where id=rid for update;
 select * into p from public.room_history_proposals where id=p_id for update;
 if auth.uid() is null or p.id is null or not public.is_room_member(rid) or not(auth.uid()=any(p.voters)) then raise exception '투표 권한이 없습니다.';end if;
 if p.status not in ('pending','approved') then return p.status;end if;
 if p.expires_at<=now() then update public.room_history_proposals set status='expired' where id=p_id;return 'expired';end if;
 select array_agg(user_id order by user_id) into ids from public.chat_members where room_id=rid;
 if r.group_mode<>'team' or r.owner_id<>p.proposer or ids is distinct from p.voters or r.membership_version<>p.membership_version or r.policy_version<>p.policy_version then update public.room_history_proposals set status='invalidated' where id=p_id;return 'invalidated';end if;
 if p.status='approved' then return 'approved';end if;
 if p_agree is null then raise exception '동의 여부를 선택해 주세요.';end if;
 if exists(select 1 from public.room_history_votes where proposal_id=p_id and user_id=auth.uid()) then return p.status;end if;
 insert into public.room_history_votes values(p_id,auth.uid(),p_agree);
 if not p_agree then
  update public.room_history_proposals set status='rejected' where id=p_id;
  perform public.group_event(rid,'이전 기록 공개 초대 제안이 거절되어 종료되었습니다.');return 'rejected';
 end if;
 if (select count(*) from public.room_history_votes where proposal_id=p_id and agree)=cardinality(p.voters) then
  update public.room_history_proposals set status='approved' where id=p_id;
  perform public.group_event(rid,'이전 기록 공개에 전원이 동의했습니다. 기한 내 방장이 초대를 완료할 수 있습니다.');return 'approved';
 end if;
 return 'pending';
end $$;

create function public.finish_history_invitation(p_id uuid,p_cancel boolean default false) returns text language plpgsql security definer set search_path='' as $$
declare p public.room_history_proposals;r public.chat_rooms;rid uuid;ids uuid[];names text;
begin
 select room_id into rid from public.room_history_proposals where id=p_id;
 select * into r from public.chat_rooms where id=rid for update;
 select * into p from public.room_history_proposals where id=p_id for update;
 if auth.uid() is null or p.id is null or r.owner_id is distinct from auth.uid() or p.proposer<>auth.uid() or not public.is_room_member(rid) then raise exception '제안한 방장만 완료하거나 취소할 수 있습니다.';end if;
 if p.status not in ('pending','approved') then return p.status;end if;
 if p_cancel then update public.room_history_proposals set status='cancelled' where id=p_id;return 'cancelled';end if;
 if p.expires_at<=now() then update public.room_history_proposals set status='expired' where id=p_id;return 'expired';end if;
 select array_agg(user_id order by user_id) into ids from public.chat_members where room_id=rid;
 if r.group_mode<>'team' or ids is distinct from p.voters or r.membership_version<>p.membership_version or r.policy_version<>p.policy_version then update public.room_history_proposals set status='invalidated' where id=p_id;return 'invalidated';end if;
 if p.status<>'approved' or (select count(*) from public.room_history_votes where proposal_id=p_id and agree)<>cardinality(p.voters) then raise exception '기존 참여자 전원의 동의가 필요합니다.';end if;
 -- Mark before membership triggers; a failed invite rolls back everything.
 update public.room_history_proposals set status='accepted' where id=p_id;
 perform public.invite_group_members(rid,p.targets);
 update public.chat_members set visible_after_sequence=0 where room_id=rid and user_id=any(p.targets);
 -- Keep joined/read positions at admission: old messages are not newly unread.
 select string_agg(display_name||' (@'||username||')',', ' order by username) into names from public.profiles where id=any(p.targets);
 perform public.group_event(rid,names||'님이 참여했습니다. 기존 참여자 전원 동의로 이전 대화·사진·파일·게시글·공지 열람을 허용했습니다. 삭제·만료된 원본은 복구되지 않습니다.');
 return 'accepted';
end $$;

alter function public.get_group_state(uuid) rename to get_group_state_v20;
create function public.get_group_state(p_room uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;p public.room_history_proposals;
begin
 result:=public.get_group_state_v20(p_room);
 select * into p from public.room_history_proposals where room_id=p_room order by created_at desc,id limit 1;
 return result||jsonb_build_object('history_proposal',case when p.id is null then null else jsonb_build_object(
 'id',p.id,'proposer',p.proposer,'status',case when p.status in ('pending','approved') and p.expires_at<=now() then 'expired' else p.status end,
 'expires_at',p.expires_at,'total',cardinality(p.voters),'agreed',(select count(*) from public.room_history_votes where proposal_id=p.id and agree),
 'my_vote',(select agree from public.room_history_votes where proposal_id=p.id and user_id=auth.uid()),
 'targets',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'display_name',display_name,'username',username) order by username),'[]') from public.profiles where id=any(p.targets))) end);
end $$;
revoke all on function public.invalidate_history_invitation(),public.get_group_state_v20(uuid) from public,anon,authenticated;
revoke all on function public.propose_history_invitation(uuid,uuid,uuid[]),public.vote_history_invitation(uuid,boolean),public.finish_history_invitation(uuid,boolean),public.get_group_state(uuid) from public,anon;
grant execute on function public.propose_history_invitation(uuid,uuid,uuid[]),public.vote_history_invitation(uuid,boolean),public.finish_history_invitation(uuid,boolean),public.get_group_state(uuid) to authenticated;
commit;
