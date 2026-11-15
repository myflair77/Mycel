begin;
create table public.collaboration_spaces(room_id uuid primary key references public.chat_rooms(id),created_at timestamptz not null default now());
alter table public.collaboration_spaces enable row level security;
revoke all on public.collaboration_spaces from public,anon,authenticated;
alter table public.workspace_items add column space_id uuid references public.collaboration_spaces(room_id);
create function public.create_space(p_key uuid,p_name text,p_users uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid;
begin
 if auth.uid() is null or p_key is null or p_name is null or char_length(trim(p_name)) not between 1 and 60 then raise exception '공간 이름을 1~60자로 입력해 주세요.';end if;
 perform pg_advisory_xact_lock(hashtextextended('group:'||auth.uid()::text,0));
 select s.room_id into r from public.collaboration_spaces s join public.chat_rooms c on c.id=s.room_id where c.direct_key='group:'||p_key::text and c.owner_id=auth.uid();
 if found then return r;end if;
 if not public.social_quota('group_create',10,3600) then raise exception '공간 생성 횟수 제한입니다.';end if;
 insert into public.chat_rooms(direct_key,group_name,group_creator,group_mode,owner_id) values('group:'||p_key::text,trim(p_name),auth.uid(),'team',auth.uid()) returning id into r;
 insert into public.chat_members(room_id,user_id) values(r,auth.uid());
 if coalesce(cardinality(p_users),0)>0 then perform public.invite_group_members(r,p_users);end if;
 perform public.group_event(r,'공간이 만들어졌습니다.');
 insert into public.collaboration_spaces(room_id) values(r) on conflict do nothing;return r;
end $$;
create function public.list_spaces() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.group_name,'owner_id',r.owner_id) order by s.created_at desc),'[]') from public.collaboration_spaces s join public.chat_rooms r on r.id=s.room_id where public.is_room_member(r.id)
$$;
create or replace function public.workspace_permission(p_id uuid,p_room uuid default null) returns integer language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then 0
 when i.space_id is not null then case when not public.is_room_member(i.space_id) or (p_room is not null and p_room<>i.space_id) then 0 when public.group_manager(i.space_id) then 4 when i.trashed then 0 when i.owner_id=auth.uid() or i.body->>'allow_edit'='true' then 3 else 2 end
 when i.owner_id=auth.uid() then 4 when i.trashed then 0 else coalesce((select max(case s.permission when 'edit' then 3 when 'comment' then 2 else 1 end) from public.workspace_shares s where s.item_id=i.id and (p_room is null or s.room_id=p_room) and public.can_read_chat_sequence(s.room_id,s.history_sequence)),0) end from public.workspace_items i where i.id=p_id
$$;
create function public.create_space_item(p_id uuid,p_kind text,p_title text,p_body jsonb,p_space uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if p_space is not null then
 if not exists(select 1 from public.collaboration_spaces where room_id=p_space) then raise exception '공간이 없습니다.';end if;
 perform public.assert_room_write(p_space);
 end if;
 if exists(select 1 from public.workspace_items where id=p_id) then if exists(select 1 from public.workspace_items where id=p_id and owner_id=auth.uid() and space_id is not distinct from p_space) then return p_id;else raise exception '자료 식별자가 이미 사용 중입니다.';end if;end if;
 perform public.workspace_create(p_id,p_kind,p_title,p_body);
 if exists(select 1 from public.workspace_items where id=p_id and space_id is not null and space_id is distinct from p_space) then raise exception '다른 공간의 자료입니다.';end if;
 update public.workspace_items set space_id=p_space where id=p_id and owner_id=auth.uid();return p_id;
end $$;
create or replace function public.workspace_list(p_kind text,p_room uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]') from (select i.*,public.workspace_permission(i.id,p_room) as permission,(select coalesce(jsonb_agg(jsonb_build_object('room_id',s.room_id,'permission',s.permission)),'[]') from public.workspace_shares s where s.item_id=i.id and (i.owner_id=auth.uid() or public.can_read_chat_sequence(s.room_id,s.history_sequence))) as shares from public.workspace_items i where i.kind=p_kind and coalesce(public.workspace_permission(i.id,p_room),0)>0 and (p_room is null or i.space_id=p_room or exists(select 1 from public.workspace_shares s where s.item_id=i.id and s.room_id=p_room and public.can_read_chat_sequence(s.room_id,s.history_sequence))))x);
end $$;
create or replace function public.workspace_trash(p_id uuid,p_version bigint,p_trash boolean) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;
begin
 select * into i from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id),0)<>4 or i.version<>p_version then raise exception '소유자 권한과 최신 버전을 확인해 주세요.';end if;
 update public.workspace_items set trashed=p_trash,version=version+1,updated_at=now() where id=p_id;perform public.workspace_record(p_id,case when p_trash then '휴지통 이동' else '휴지통 복원' end);
end $$;
create or replace function public.workspace_restore(p_id uuid,p_history bigint,p_version bigint) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;h public.workspace_history;b jsonb;
begin
 select * into i from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id),0)<>4 or i.version<>p_version or i.trashed then raise exception '소유자 권한과 최신 버전을 확인해 주세요.';end if;
 select * into h from public.workspace_history where id=p_history and item_id=p_id;
 if not found then raise exception '수정 이력이 없습니다.';end if;
 update public.workspace_items set title=h.snapshot->>'title',body=h.snapshot->'body',version=version+1,updated_at=now() where id=p_id;
 update public.note_blocks set deleted=true,version=version+1 where item_id=p_id;
 for b in select value from jsonb_array_elements(h.snapshot->'blocks') loop
 update public.note_blocks set kind=b->>'kind',content=b->'content',position=(b->>'position')::int,deleted=(b->>'deleted')::boolean where id=(b->>'id')::uuid and item_id=p_id;
 end loop;perform public.workspace_record(p_id,'이전 버전 복원');
end $$;
create or replace function public.workspace_get(p_id uuid,p_room uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;perm integer;floor_revision bigint;
begin
 select * into i from public.workspace_items where id=p_id;
 perm:=coalesce(public.workspace_permission(p_id,p_room),0);if perm=0 then raise exception '자료 접근 권한이 없습니다.';end if;
 insert into public.workspace_access values(p_id,auth.uid(),i.version) on conflict do nothing;
 select revision_floor into floor_revision from public.workspace_access where item_id=p_id and user_id=auth.uid();
 return jsonb_build_object('item',to_jsonb(i),'permission',perm,'blocks',(select coalesce(jsonb_agg(to_jsonb(b) order by b.position,b.id),'[]') from public.note_blocks b where b.item_id=p_id and not b.deleted),
 'history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.revision desc),'[]') from (select h.id,h.revision,h.action,h.created_at,u.display_name as actor from public.workspace_history h join public.profiles u on u.id=h.actor where h.item_id=p_id and (perm=4 or (perm=3 and h.revision>=greatest(floor_revision,coalesce((select min(s.revision_floor) from public.workspace_shares s where s.item_id=p_id and s.permission='edit' and (p_room is null or s.room_id=p_room) and public.can_read_chat_sequence(s.room_id,s.history_sequence)),case when i.space_id is not null then floor_revision else i.version end)))) )h),
 'comments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]') from (select c.*,u.display_name as author_name from public.workspace_comments c join public.profiles u on u.id=c.author where c.item_id=p_id and ((p_room is not null and c.room_id=p_room and public.is_room_member(p_room)) or (p_room is null and c.room_id is null and i.owner_id=auth.uid())))x),
 'shares',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.workspace_shares s where s.item_id=p_id and (i.owner_id=auth.uid() or public.can_read_chat_sequence(s.room_id,s.history_sequence))));
end $$;

revoke all on function public.create_space(uuid,text,uuid[]),public.list_spaces(),public.create_space_item(uuid,text,text,jsonb,uuid) from public,anon;
grant execute on function public.create_space(uuid,text,uuid[]),public.list_spaces(),public.create_space_item(uuid,text,text,jsonb,uuid) to authenticated;

create function public.workspace_copy(p_id uuid,p_new uuid,p_space uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;
begin
 select * into i from public.workspace_items where id=p_id;
 if coalesce(public.workspace_permission(p_id),0)=0 or i.trashed then raise exception '자료 접근 권한이 없습니다.';end if;
 if exists(select 1 from public.workspace_items where id=p_new) then raise exception '이미 사용된 식별자입니다.';end if;
 perform public.create_space_item(p_new,i.kind,i.title||' (복사)',i.body-'allow_edit',p_space);
 insert into public.note_blocks(id,item_id,kind,content,position) select gen_random_uuid(),p_new,kind,content,position from public.note_blocks where item_id=p_id and not deleted;
 update public.workspace_items set version=version+1 where id=p_new;perform public.workspace_record(p_new,'원본에서 독립 복사');return p_new;
end $$;
create function public.workspace_history_view(p_id uuid,p_history bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;h public.workspace_history;
begin
 d:=public.workspace_get(p_id);
 if not exists(select 1 from jsonb_array_elements(d->'history') x where (x->>'id')::bigint=p_history) then raise exception '이력 접근 권한이 없습니다.';end if;
 select * into h from public.workspace_history where id=p_history and item_id=p_id;return h.snapshot;
end $$;
-- Prevent downgrading the team permissions backing a space.
alter function public.propose_group_mode(uuid,uuid,text,uuid,text) rename to propose_group_mode_before_spaces;
revoke all on function public.propose_group_mode_before_spaces(uuid,uuid,text,uuid,text) from public,anon,authenticated;
create function public.propose_group_mode(p_room uuid,p_id uuid,p_mode text,p_candidate uuid,p_policy text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.collaboration_spaces where room_id=p_room) then raise exception '공간은 일반 그룹채팅으로 전환할 수 없습니다.';end if;
 return public.propose_group_mode_before_spaces(p_room,p_id,p_mode,p_candidate,p_policy);
end $$;
revoke all on function public.workspace_copy(uuid,uuid,uuid),public.workspace_history_view(uuid,bigint),public.propose_group_mode(uuid,uuid,text,uuid,text) from public,anon;
grant execute on function public.workspace_copy(uuid,uuid,uuid),public.workspace_history_view(uuid,bigint),public.propose_group_mode(uuid,uuid,text,uuid,text) to authenticated;
create or replace function public.workspace_save(p_id uuid,p_version bigint,p_title text,p_body jsonb) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;
begin
 select * into i from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id),0)<3 or i.trashed then raise exception '편집 권한이 없습니다.';end if;
 if i.version<>p_version then raise exception '다른 수정이 있습니다. 내 입력을 보관한 뒤 최신 내용을 확인해 주세요.';end if;
 if p_title is null or char_length(trim(p_title)) not between 1 and 200 or octet_length(p_body::text)>50000 then raise exception '제목 또는 설명 길이를 확인해 주세요.';end if;
 if i.kind='event' and (p_body->>'start' is null or p_body->>'end' is null or (p_body->>'start')::timestamptz>(p_body->>'end')::timestamptz) then raise exception '일정 시작·종료를 확인해 주세요.';end if;
 if (i.body->'allow_edit') is distinct from (p_body->'allow_edit') and public.workspace_permission(p_id)<>4 then raise exception '관리자만 편집 범위를 변경할 수 있습니다.';end if;
 update public.workspace_items set title=trim(p_title),body=p_body,version=version+1,updated_at=now() where id=p_id;
 perform public.workspace_record(p_id,'제목·내용 수정');
end $$;

-- Validate JSON at the database boundary, including direct RPC callers.
create function public.validate_workspace_json() returns trigger language plpgsql set search_path='' as $$
declare r jsonb;v jsonb;
begin
 if TG_TABLE_NAME='workspace_items' then
  if jsonb_typeof(new.body) is distinct from 'object' or octet_length(new.body::text)>50000 then raise exception '자료 형식을 확인해 주세요.';end if;
  if new.body ? 'allow_edit' and jsonb_typeof(new.body->'allow_edit')<>'boolean' then raise exception '편집 설정을 확인해 주세요.';end if;
  if new.kind='event' and (new.body->>'start' is null or new.body->>'end' is null or not isfinite((new.body->>'start')::timestamptz) or not isfinite((new.body->>'end')::timestamptz) or (new.body->>'start')::timestamptz>(new.body->>'end')::timestamptz) then raise exception '일정 시작·종료를 확인해 주세요.';end if;
 else
  if jsonb_typeof(new.content) is distinct from 'object' then raise exception '블록 형식을 확인해 주세요.';end if;
  if new.kind='table' then
   if jsonb_typeof(new.content->'rows') is distinct from 'array' then raise exception '표 형식을 확인해 주세요.';end if;
   if jsonb_array_length(new.content->'rows') not between 1 and 50 then raise exception '표는 최대 50행입니다.';end if;
   for r in select value from jsonb_array_elements(new.content->'rows') loop
    if jsonb_typeof(r)<>'array' then raise exception '표 행을 확인해 주세요.';end if;
    if jsonb_array_length(r) not between 1 and 12 then raise exception '표는 최대 12열입니다.';end if;
    for v in select value from jsonb_array_elements(r) loop
     if jsonb_typeof(v)<>'string' then raise exception '표 셀은 텍스트입니다.';end if;
    end loop;
   end loop;
  elsif jsonb_typeof(new.content->'text') is distinct from 'string' then raise exception '블록 텍스트를 확인해 주세요.';end if;
 end if;
 return new;
end $$;
create trigger validate_workspace_item before insert or update on public.workspace_items for each row execute function public.validate_workspace_json();
create trigger validate_workspace_block before insert or update on public.note_blocks for each row execute function public.validate_workspace_json();
revoke all on function public.validate_workspace_json() from public,anon,authenticated;
create function public.guard_space_share() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.workspace_items where id=new.item_id and space_id is not null) then raise exception '공간 소유 자료는 원본을 외부 공간에 공유할 수 없습니다.';end if;
 return new;
end $$;
create trigger guard_space_share before insert or update on public.workspace_shares for each row execute function public.guard_space_share();
revoke all on function public.guard_space_share() from public,anon,authenticated;
-- Comment revisions remain independent from document snapshots to avoid leaking room comments.
create table public.workspace_comment_history(id bigint generated always as identity primary key,comment_id uuid not null references public.workspace_comments(id),version bigint not null,body text not null,resolved boolean not null,deleted boolean not null,created_at timestamptz not null default now());
alter table public.workspace_comment_history enable row level security;
revoke all on public.workspace_comment_history from public,anon,authenticated;
create function public.record_workspace_comment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.workspace_comment_history(comment_id,version,body,resolved,deleted) values(new.id,new.version,new.body,new.resolved,new.deleted);return new;
end $$;
create trigger record_workspace_comment after insert or update on public.workspace_comments for each row execute function public.record_workspace_comment();
revoke all on function public.record_workspace_comment() from public,anon,authenticated;
create function public.workspace_comment_revisions(p_comment uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.workspace_comments;
begin
 select * into c from public.workspace_comments where id=p_comment;
 if c.author is distinct from auth.uid() or coalesce(public.workspace_permission(c.item_id,c.room_id),0)=0 then raise exception '댓글 이력 접근 권한이 없습니다.';end if;
 return (select coalesce(jsonb_agg(to_jsonb(h) order by h.version desc),'[]') from public.workspace_comment_history h where h.comment_id=p_comment);
end $$;
revoke all on function public.workspace_comment_revisions(uuid) from public,anon;
grant execute on function public.workspace_comment_revisions(uuid) to authenticated;

commit;
