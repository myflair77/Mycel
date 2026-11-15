begin;
-- Permanent retention: no expiry, cleanup job or hard-delete API.
create table public.workspace_items(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('note','event')),owner_id uuid not null references public.profiles(id),title text not null,body jsonb not null default '{}',version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),trashed boolean not null default false);
create table public.workspace_shares(item_id uuid references public.workspace_items(id),room_id uuid references public.chat_rooms(id),permission text not null check(permission in ('read','comment','edit')),history_sequence bigint not null,revision_floor bigint not null,primary key(item_id,room_id));
create table public.note_blocks(id uuid primary key,item_id uuid not null references public.workspace_items(id),kind text not null check(kind in ('text','heading','list','check','quote','divider','table','link')),content jsonb not null,position integer not null,version bigint not null default 1,deleted boolean not null default false);
create table public.workspace_history(id bigint generated always as identity primary key,item_id uuid not null references public.workspace_items(id),actor uuid not null references public.profiles(id),created_at timestamptz not null default now(),revision bigint not null,action text not null,snapshot jsonb not null);
create table public.workspace_comments(id uuid primary key default gen_random_uuid(),item_id uuid not null references public.workspace_items(id),room_id uuid references public.chat_rooms(id),block_id uuid references public.note_blocks(id),parent_id uuid references public.workspace_comments(id),author uuid not null references public.profiles(id),body text not null,version bigint not null default 1,resolved boolean not null default false,deleted boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.workspace_access(item_id uuid references public.workspace_items(id),user_id uuid references public.profiles(id),revision_floor bigint not null,primary key(item_id,user_id));
create index workspace_owner on public.workspace_items(owner_id,updated_at desc);
create index workspace_share_room on public.workspace_shares(room_id);
create index workspace_blocks on public.note_blocks(item_id,position);
create index workspace_history_item on public.workspace_history(item_id,revision);
create index workspace_comments_item on public.workspace_comments(item_id,created_at);
alter table public.workspace_items enable row level security;
alter table public.workspace_shares enable row level security;
alter table public.note_blocks enable row level security;
alter table public.workspace_history enable row level security;
alter table public.workspace_comments enable row level security;
alter table public.workspace_access enable row level security;
revoke all on public.workspace_items,public.workspace_shares,public.note_blocks,public.workspace_history,public.workspace_comments,public.workspace_access from public,anon,authenticated;
create function public.workspace_permission(p_id uuid,p_room uuid default null) returns integer language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then 0 when i.owner_id=auth.uid() then 4 when i.trashed then 0 else coalesce((select max(case s.permission when 'edit' then 3 when 'comment' then 2 else 1 end) from public.workspace_shares s where s.item_id=i.id and (p_room is null or s.room_id=p_room) and public.can_read_chat_sequence(s.room_id,s.history_sequence)),0) end from public.workspace_items i where i.id=p_id
$$;
create function public.workspace_snapshot(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('title',i.title,'body',i.body,'trashed',i.trashed,'blocks',(select coalesce(jsonb_agg(to_jsonb(b) order by b.position,b.id),'[]') from public.note_blocks b where b.item_id=i.id)) from public.workspace_items i where i.id=p_id
$$;
create function public.workspace_record(p_id uuid,p_action text) returns void language sql security definer set search_path='' as $$
 insert into public.workspace_history(item_id,actor,revision,action,snapshot) select id,auth.uid(),version,p_action,public.workspace_snapshot(id) from public.workspace_items where id=p_id
$$;
create function public.workspace_list(p_kind text,p_room uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]') from (select i.*,public.workspace_permission(i.id,p_room) as permission,(select coalesce(jsonb_agg(jsonb_build_object('room_id',s.room_id,'permission',s.permission)),'[]') from public.workspace_shares s where s.item_id=i.id and (i.owner_id=auth.uid() or public.can_read_chat_sequence(s.room_id,s.history_sequence))) as shares from public.workspace_items i where i.kind=p_kind and coalesce(public.workspace_permission(i.id,p_room),0)>0 and (p_room is null or exists(select 1 from public.workspace_shares s where s.item_id=i.id and s.room_id=p_room and public.can_read_chat_sequence(s.room_id,s.history_sequence))))x);
end $$;
create function public.workspace_get(p_id uuid,p_room uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;perm integer;floor_revision bigint;
begin
 select * into i from public.workspace_items where id=p_id;
 perm:=coalesce(public.workspace_permission(p_id,p_room),0);if perm=0 then raise exception '자료 접근 권한이 없습니다.';end if;
 insert into public.workspace_access values(p_id,auth.uid(),i.version) on conflict do nothing;
 select revision_floor into floor_revision from public.workspace_access where item_id=p_id and user_id=auth.uid();
 return jsonb_build_object('item',to_jsonb(i),'permission',perm,'blocks',(select coalesce(jsonb_agg(to_jsonb(b) order by b.position,b.id),'[]') from public.note_blocks b where b.item_id=p_id and not b.deleted),
 'history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.revision desc),'[]') from (select h.id,h.revision,h.action,h.created_at,u.display_name as actor from public.workspace_history h join public.profiles u on u.id=h.actor where h.item_id=p_id and (perm=4 or (perm=3 and h.revision>=greatest(floor_revision,coalesce((select min(s.revision_floor) from public.workspace_shares s where s.item_id=p_id and s.permission='edit' and (p_room is null or s.room_id=p_room) and public.can_read_chat_sequence(s.room_id,s.history_sequence)),i.version)))) )h),
 'comments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]') from (select c.*,u.display_name as author_name from public.workspace_comments c join public.profiles u on u.id=c.author where c.item_id=p_id and ((p_room is not null and c.room_id=p_room and public.is_room_member(p_room)) or (p_room is null and c.room_id is null and i.owner_id=auth.uid())))x),
 'shares',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.workspace_shares s where s.item_id=p_id and (i.owner_id=auth.uid() or public.can_read_chat_sequence(s.room_id,s.history_sequence))));
end $$;
create function public.workspace_create(p_id uuid,p_kind text,p_title text,p_body jsonb default '{}') returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_kind not in ('note','event') or char_length(trim(p_title)) not between 1 and 200 then raise exception '제목을 입력해 주세요.';end if;
 if exists(select 1 from public.workspace_items where id=p_id and owner_id=auth.uid()) then return p_id;end if;
 insert into public.workspace_items(id,kind,owner_id,title,body) values(p_id,p_kind,auth.uid(),trim(p_title),p_body);
 perform public.workspace_record(p_id,'만들기');return p_id;
end $$;
create function public.workspace_save(p_id uuid,p_version bigint,p_title text,p_body jsonb) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;
begin
 select * into i from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id),0)<3 or i.trashed then raise exception '편집 권한이 없습니다.';end if;
 if i.version<>p_version then raise exception '다른 수정이 있습니다. 내 입력을 보관한 뒤 최신 내용을 확인해 주세요.';end if;
 if p_title is null or char_length(trim(p_title)) not between 1 and 200 or octet_length(p_body::text)>50000 then raise exception '제목 또는 설명 길이를 확인해 주세요.';end if;
 if i.kind='event' and (p_body->>'start' is null or p_body->>'end' is null or (p_body->>'start')::timestamptz>(p_body->>'end')::timestamptz) then raise exception '일정 시작·종료를 확인해 주세요.';end if;
 update public.workspace_items set title=trim(p_title),body=p_body,version=version+1,updated_at=now() where id=p_id;
 perform public.workspace_record(p_id,'제목·내용 수정');
end $$;
create function public.note_block_save(p_id uuid,p_block uuid,p_version bigint,p_kind text,p_content jsonb,p_deleted boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;b public.note_blocks;
begin
 select * into i from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id),0)<3 or i.trashed or i.kind<>'note' then raise exception '편집 권한이 없습니다.';end if;
 select * into b from public.note_blocks where id=p_block;
 if found and (b.item_id<>p_id or b.version<>p_version) then raise exception '블록 충돌: 내 입력을 보관한 뒤 최신 내용을 확인해 주세요.';end if;
 if b.id is null and p_version<>0 then raise exception '블록 버전을 확인해 주세요.';end if;
 if octet_length(p_content::text)>50000 or p_content is null then raise exception '블록 내용이 너무 큽니다.';end if;
 if b.id is null and (select count(*) from public.note_blocks where item_id=p_id and not deleted)>=300 then raise exception '노트당 최대 300개 블록입니다.';end if;
 insert into public.note_blocks(id,item_id,kind,content,position,deleted) values(p_block,p_id,p_kind,p_content,coalesce((select max(position)+1 from public.note_blocks where item_id=p_id),0),p_deleted) on conflict(id) do update set kind=excluded.kind,content=excluded.content,deleted=excluded.deleted,version=public.note_blocks.version+1;
 update public.workspace_items set version=version+1,updated_at=now() where id=p_id;perform public.workspace_record(p_id,'블록 수정');
end $$;
create function public.note_block_move(p_id uuid,p_block uuid,p_version bigint,p_direction integer) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;b public.note_blocks;other public.note_blocks;
begin
 select * into i from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id),0)<3 or i.trashed then raise exception '편집 권한이 없습니다.';end if;
 if i.version<>p_version or p_direction not in (-1,1) then raise exception '순서가 변경되었습니다. 새로 확인해 주세요.';end if;
 select * into b from public.note_blocks where id=p_block and item_id=p_id and not deleted;
 select * into other from public.note_blocks where item_id=p_id and not deleted and case when p_direction=-1 then position<b.position else position>b.position end order by case when p_direction=-1 then -position else position end limit 1;
 if other.id is null then return;end if;
 update public.note_blocks set position=case when id=b.id then other.position else b.position end where id in(b.id,other.id);
 update public.workspace_items set version=version+1,updated_at=now() where id=p_id;perform public.workspace_record(p_id,'블록 순서 변경');
end $$;
create function public.workspace_share(p_id uuid,p_room uuid,p_permission text,p_remove boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;m public.messages;
begin
 select * into i from public.workspace_items where id=p_id for update;
 if auth.uid() is null or not public.is_room_member(p_room) then raise exception '대화방 접근 권한이 없습니다.';end if;
 if i.owner_id<>auth.uid() and not(p_remove and public.group_manager(p_room)) then raise exception '소유자만 공유 권한을 설정할 수 있습니다.';end if;
 if p_remove then delete from public.workspace_shares where item_id=p_id and room_id=p_room;
 else
 if i.trashed or p_permission not in ('read','comment','edit') then raise exception '공유 설정을 확인해 주세요.';end if;
 perform public.assert_room_write(p_room);
 if i.kind='event' and exists(select 1 from public.workspace_shares where item_id=p_id and room_id<>p_room) then raise exception '일정은 하나의 대화방에 공유할 수 있습니다.';end if;
 m:=public.send_message(p_room,case when i.kind='event' then '[일정] ' else '[공유노트] ' end||i.title,gen_random_uuid());
 insert into public.workspace_shares values(p_id,p_room,p_permission,m.sequence,i.version) on conflict(item_id,room_id) do update set permission=excluded.permission;
 end if;
 update public.workspace_items set version=version+1,updated_at=now() where id=p_id;perform public.workspace_record(p_id,'공유 설정 변경');
end $$;
create function public.workspace_trash(p_id uuid,p_version bigint,p_trash boolean) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;
begin
 select * into i from public.workspace_items where id=p_id for update;
 if i.owner_id is distinct from auth.uid() or i.version<>p_version then raise exception '소유자 권한과 최신 버전을 확인해 주세요.';end if;
 update public.workspace_items set trashed=p_trash,version=version+1,updated_at=now() where id=p_id;perform public.workspace_record(p_id,case when p_trash then '휴지통 이동' else '휴지통 복원' end);
end $$;
create function public.workspace_restore(p_id uuid,p_history bigint,p_version bigint) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;h public.workspace_history;b jsonb;
begin
 select * into i from public.workspace_items where id=p_id for update;
 if i.owner_id is distinct from auth.uid() or i.version<>p_version or i.trashed then raise exception '소유자 권한과 최신 버전을 확인해 주세요.';end if;
 select * into h from public.workspace_history where id=p_history and item_id=p_id;
 if not found then raise exception '수정 이력이 없습니다.';end if;
 update public.workspace_items set title=h.snapshot->>'title',body=h.snapshot->'body',version=version+1,updated_at=now() where id=p_id;
 update public.note_blocks set deleted=true,version=version+1 where item_id=p_id;
 for b in select value from jsonb_array_elements(h.snapshot->'blocks') loop
 update public.note_blocks set kind=b->>'kind',content=b->'content',position=(b->>'position')::int,deleted=(b->>'deleted')::boolean where id=(b->>'id')::uuid and item_id=p_id;
 end loop;perform public.workspace_record(p_id,'이전 버전 복원');
end $$;
create function public.workspace_comment(p_id uuid,p_room uuid,p_comment uuid,p_body text,p_version bigint default 0,p_parent uuid default null,p_block uuid default null,p_resolved boolean default false,p_deleted boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare c public.workspace_comments;perm integer;
begin
 perform 1 from public.workspace_items where id=p_id for update;
 perm:=coalesce(public.workspace_permission(p_id,p_room),0);
 if perm<2 or exists(select 1 from public.workspace_items where id=p_id and trashed) or (p_room is null and perm<>4) or (p_room is not null and not public.is_room_member(p_room)) then raise exception '댓글 권한이 없습니다.';end if;
 if p_body is null or char_length(trim(p_body)) not between 1 and 4000 then raise exception '댓글은 1~4000자입니다.';end if;
 select * into c from public.workspace_comments where id=p_comment for update;
 if found and (c.item_id<>p_id or c.room_id is distinct from p_room or c.author<>auth.uid() or c.version<>p_version) then raise exception '댓글 작성자와 최신 버전을 확인해 주세요.';end if;
 if p_parent is not null and not exists(select 1 from public.workspace_comments where id=p_parent and item_id=p_id and room_id is not distinct from p_room) then raise exception '답글 대상을 확인해 주세요.';end if;
 if p_block is not null and not exists(select 1 from public.note_blocks where id=p_block and item_id=p_id) then raise exception '블록을 확인해 주세요.';end if;
 insert into public.workspace_comments(id,item_id,room_id,block_id,parent_id,author,body,resolved,deleted) values(p_comment,p_id,p_room,p_block,p_parent,auth.uid(),trim(p_body),p_resolved,p_deleted) on conflict(id) do update set body=excluded.body,resolved=excluded.resolved,deleted=excluded.deleted,version=public.workspace_comments.version+1,updated_at=now();
end $$;
revoke all on function public.workspace_snapshot(uuid),public.workspace_record(uuid,text) from public,anon,authenticated;
revoke all on function public.workspace_permission(uuid,uuid) from public,anon;
grant execute on function public.workspace_permission(uuid,uuid) to authenticated;
revoke all on function public.workspace_list(text,uuid) from public,anon;
grant execute on function public.workspace_list(text,uuid) to authenticated;
revoke all on function public.workspace_get(uuid,uuid) from public,anon;
grant execute on function public.workspace_get(uuid,uuid) to authenticated;
revoke all on function public.workspace_create(uuid,text,text,jsonb) from public,anon;
grant execute on function public.workspace_create(uuid,text,text,jsonb) to authenticated;
revoke all on function public.workspace_save(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.workspace_save(uuid,bigint,text,jsonb) to authenticated;
revoke all on function public.note_block_save(uuid,uuid,bigint,text,jsonb,boolean) from public,anon;
grant execute on function public.note_block_save(uuid,uuid,bigint,text,jsonb,boolean) to authenticated;
revoke all on function public.note_block_move(uuid,uuid,bigint,integer) from public,anon;
grant execute on function public.note_block_move(uuid,uuid,bigint,integer) to authenticated;
revoke all on function public.workspace_share(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.workspace_share(uuid,uuid,text,boolean) to authenticated;
revoke all on function public.workspace_trash(uuid,bigint,boolean) from public,anon;
grant execute on function public.workspace_trash(uuid,bigint,boolean) to authenticated;
revoke all on function public.workspace_restore(uuid,bigint,bigint) from public,anon;
grant execute on function public.workspace_restore(uuid,bigint,bigint) to authenticated;
revoke all on function public.workspace_comment(uuid,uuid,uuid,text,bigint,uuid,uuid,boolean,boolean) from public,anon;
grant execute on function public.workspace_comment(uuid,uuid,uuid,text,bigint,uuid,uuid,boolean,boolean) to authenticated;
commit;
