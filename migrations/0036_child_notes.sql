begin;
-- Existing notes remain roots; no existing body, permission or identity is rewritten.
alter table public.workspace_items add column parent_id uuid references public.workspace_items(id);
alter table public.workspace_items add column trash_batch uuid;
create index workspace_parent on public.workspace_items(parent_id);
alter function public.workspace_permission(uuid,uuid) rename to workspace_permission_before_children;
revoke all on function public.workspace_permission_before_children(uuid,uuid) from public,anon,authenticated;
create function public.workspace_root(p_id uuid) returns uuid language sql stable security definer set search_path='' as $$
 with recursive chain as (select id,parent_id,array[id] path from public.workspace_items where id=p_id union all select i.id,i.parent_id,c.path||i.id from public.workspace_items i join chain c on i.id=c.parent_id where not i.id=any(c.path)) select id from chain where parent_id is null
$$;
revoke all on function public.workspace_root(uuid) from public,anon,authenticated;
create function public.workspace_permission(p_id uuid,p_room uuid default null) returns integer language plpgsql stable security definer set search_path='' as $$
declare root uuid;perm int;hidden boolean;
begin
 root:=public.workspace_root(p_id);if root is null then return 0;end if;
 perm:=coalesce(public.workspace_permission_before_children(root,p_room),0);
 with recursive chain as (select id,parent_id,trashed from public.workspace_items where id=p_id union all select i.id,i.parent_id,i.trashed from public.workspace_items i join chain c on i.id=c.parent_id) select bool_or(trashed) into hidden from chain;
 return case when hidden and perm<4 then 0 else perm end;
end $$;
revoke all on function public.workspace_permission(uuid,uuid) from public,anon;
grant execute on function public.workspace_permission(uuid,uuid) to authenticated;

alter function public.workspace_list(text,uuid) rename to workspace_list_before_children;
revoke all on function public.workspace_list_before_children(text,uuid) from public,anon,authenticated;
create function public.workspace_list(p_kind text,p_room uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 return (with recursive visible as (
 select i.id from public.workspace_items i where i.id in(select (x->>'id')::uuid from jsonb_array_elements(public.workspace_list_before_children(p_kind,p_room)) x)
 union select i.id from public.workspace_items i join visible v on i.parent_id=v.id where coalesce(public.workspace_permission(i.id,p_room),0)>0
 ) select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('creator_name',u.display_name,'permission',public.workspace_permission(i.id,p_room)) order by i.created_at desc),'[]') from visible v join public.workspace_items i on i.id=v.id join public.profiles u on u.id=i.owner_id where i.kind=p_kind);
end $$;
revoke all on function public.workspace_list(text,uuid) from public,anon;
grant execute on function public.workspace_list(text,uuid) to authenticated;

alter function public.workspace_get(uuid,uuid) rename to workspace_get_before_children;
revoke all on function public.workspace_get_before_children(uuid,uuid) from public,anon,authenticated;
create function public.workspace_get(p_id uuid,p_room uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;root uuid;
begin
 result:=public.workspace_get_before_children(p_id,p_room);root:=public.workspace_root(p_id);
 return result||jsonb_build_object('ancestors',(with recursive chain as (select i.id,i.parent_id,i.title,0 depth from public.workspace_items i where i.id=p_id union all select i.id,i.parent_id,i.title,c.depth+1 from public.workspace_items i join chain c on i.id=c.parent_id) select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title) order by depth desc),'[]') from chain where id<>p_id and public.workspace_permission(id,p_room)>0),
 'children',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'icon',i.body->>'icon','trashed',i.trashed) order by i.created_at desc),'[]') from public.workspace_items i where i.parent_id=p_id and public.workspace_permission(i.id,p_room)>0),
 'inherited',root<>p_id);
end $$;
revoke all on function public.workspace_get(uuid,uuid) from public,anon;
grant execute on function public.workspace_get(uuid,uuid) to authenticated;

create function public.workspace_child_create(p_parent uuid,p_id uuid,p_version bigint,p_blocks jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;child public.workspace_items;saved bigint;depth int;
begin
 perform pg_advisory_xact_lock(36736);
 select * into i from public.workspace_items where id=p_parent for update;
 if i.kind is distinct from 'note' or i.trashed or public.workspace_permission(p_parent)<3 then raise exception '상위 노트 편집 권한이 없습니다.';end if;
 select * into child from public.workspace_items where id=p_id;
 if found then if child.parent_id=p_parent and child.owner_id=auth.uid() then return i.version;else raise exception '이미 사용된 노트 식별자입니다.';end if;end if;
 with recursive chain as(select id,parent_id from public.workspace_items where id=p_parent union all select a.id,a.parent_id from public.workspace_items a join chain c on c.parent_id=a.id)select count(*) into depth from chain;
 if depth>=20 then raise exception '하위 노트는 20단계까지 만들 수 있습니다.';end if;
 if i.version is distinct from p_version then raise exception '상위 노트가 변경되었습니다. 최신 내용을 확인해 주세요.';end if;
 if not jsonb_path_exists(p_blocks,'$[*].content._rich.** ? (@.type == "childNote" && @.attrs.noteId == $id)',jsonb_build_object('id',p_id::text)) then raise exception '하위 노트 링크를 확인해 주세요.';end if;
 insert into public.workspace_items(id,kind,owner_id,title,body,parent_id) values(p_id,'note',auth.uid(),'새 노트','{}',p_parent);
 perform public.workspace_record(p_id,'하위 노트 만들기');
 saved:=public.page_document_save(p_parent,p_version,p_id,p_blocks);
 return saved;
end $$;
revoke all on function public.workspace_child_create(uuid,uuid,bigint,jsonb) from public,anon;
grant execute on function public.workspace_child_create(uuid,uuid,bigint,jsonb) to authenticated;

-- Children never acquire independent sharing grants through the legacy endpoint.
alter function public.workspace_share(uuid,uuid,text,boolean) rename to workspace_share_before_children;
revoke all on function public.workspace_share_before_children(uuid,uuid,text,boolean) from public,anon,authenticated;
create function public.workspace_share(p_id uuid,p_room uuid,p_permission text,p_remove boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.workspace_items where id=p_id and parent_id is not null) then raise exception '하위 노트는 상위 노트의 공유 권한을 따릅니다. 별도 공유는 독립 복사본을 만들어 주세요.';end if;
 perform public.workspace_share_before_children(p_id,p_room,p_permission,p_remove);
end $$;
revoke all on function public.workspace_share(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.workspace_share(uuid,uuid,text,boolean) to authenticated;

create or replace function public.workspace_trash(p_id uuid,p_version bigint,p_trash boolean) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;x uuid;batch uuid;
begin
 perform pg_advisory_xact_lock(36736);
 select * into i from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id),0)<>4 or i.version is distinct from p_version then raise exception '관리 권한과 최신 버전을 확인해 주세요.';end if;
 if not p_trash and exists(select 1 from public.workspace_items a where a.id=i.parent_id and a.trashed) then raise exception '상위 노트를 먼저 복원해 주세요.';end if;
 batch:=case when p_trash then gen_random_uuid() else i.trash_batch end;
 for x in with recursive tree as(select id from public.workspace_items where id=p_id union all select a.id from public.workspace_items a join tree t on a.parent_id=t.id) select a.id from tree t join public.workspace_items a on a.id=t.id where (p_trash and not a.trashed) or(not p_trash and a.trashed and (a.id=p_id or a.trash_batch=batch)) loop
 update public.workspace_items set trashed=p_trash,trash_batch=case when p_trash then batch else null end,version=version+1,updated_at=now() where id=x;
 perform public.workspace_record(x,case when p_trash then '하위 노트 포함 휴지통 이동' else '하위 노트 포함 복원' end);
 end loop;
end $$;

-- Moves are restricted to the same permission root, so reorganizing cannot broaden access.
create function public.workspace_child_move(p_id uuid,p_parent uuid,p_version bigint) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;target public.workspace_items;parent_depth int;subtree_depth int;
begin
 perform pg_advisory_xact_lock(36736);
 select * into i from public.workspace_items where id=p_id for update;
 select * into target from public.workspace_items where id=p_parent for update;
 if i.parent_id is null or i.kind<>'note' or target.kind is distinct from 'note' or i.trashed or target.trashed or i.version is distinct from p_version or coalesce(public.workspace_permission(p_id),0)<3 or coalesce(public.workspace_permission(p_parent),0)<3 then raise exception '이동 권한과 최신 버전을 확인해 주세요.';end if;
 if public.workspace_root(p_id)<>public.workspace_root(p_parent) then raise exception '공유 권한이 다른 노트로는 이동할 수 없습니다. 독립 복사본을 이용해 주세요.';end if;
 if exists(with recursive tree as(select id from public.workspace_items where id=p_id union all select a.id from public.workspace_items a join tree t on a.parent_id=t.id)select 1 from tree where id=p_parent) then raise exception '자기 자신이나 하위 노트로 이동할 수 없습니다.';end if;
 with recursive chain as(select id,parent_id from public.workspace_items where id=p_parent union all select a.id,a.parent_id from public.workspace_items a join chain c on c.parent_id=a.id) select count(*) into parent_depth from chain;
 with recursive tree as(select id,1 depth from public.workspace_items where id=p_id union all select a.id,t.depth+1 from public.workspace_items a join tree t on a.parent_id=t.id) select max(depth) into subtree_depth from tree;
 if parent_depth+subtree_depth>20 then raise exception '하위 노트는 20단계까지 만들 수 있습니다.';end if;
 update public.workspace_items set parent_id=p_parent,version=version+1,updated_at=now() where id=p_id;
 perform public.workspace_record(p_id,'상위 노트 변경');
end $$;
revoke all on function public.workspace_child_move(uuid,uuid,bigint) from public,anon;
grant execute on function public.workspace_child_move(uuid,uuid,bigint) to authenticated;
-- Copy a live subtree into independent records; preserve rich formatting.
create function public.workspace_clone_rich(p_value jsonb,p_map jsonb) returns jsonb language plpgsql volatile set search_path='' as $$
declare result jsonb;k text;v jsonb;
begin
 if jsonb_typeof(p_value)='array' then return coalesce((select jsonb_agg(public.workspace_clone_rich(value,p_map)) from jsonb_array_elements(p_value)),'[]');end if;
 if jsonb_typeof(p_value)<>'object' then return p_value;end if;
 result:='{}';for k,v in select * from jsonb_each(p_value) loop
 if k='noteId' and p_map ? (v#>>'{}') then result:=result||jsonb_build_object(k,p_map->(v#>>'{}'));
 elsif k='id' then result:=result||jsonb_build_object(k,gen_random_uuid());
 else result:=result||jsonb_build_object(k,public.workspace_clone_rich(v,p_map));end if;
 end loop;return result;
end $$;
revoke all on function public.workspace_clone_rich(jsonb,jsonb) from public,anon,authenticated;
create or replace function public.workspace_copy(p_id uuid,p_new uuid,p_space uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;x record;m jsonb;newid uuid;
begin
 perform pg_advisory_xact_lock(36736);
 select * into i from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id),0)=0 or i.trashed then raise exception '자료 접근 권한이 없습니다.';end if;
 if exists(select 1 from public.workspace_items where id=p_new) then raise exception '이미 사용된 식별자입니다.';end if;
 with recursive tree as(select id from public.workspace_items where id=p_id union all select a.id from public.workspace_items a join tree t on a.parent_id=t.id where not a.trashed)select jsonb_object_agg(id::text,case when id=p_id then p_new else gen_random_uuid() end) into m from tree;
 perform public.create_space_item(p_new,i.kind,left(i.title,195)||' (복사)',i.body-'allow_edit'-'mycel_parent',p_space);
 for x in with recursive tree as(select a.*,0 depth from public.workspace_items a where id=p_id union all select a.*,t.depth+1 from public.workspace_items a join tree t on a.parent_id=t.id where not a.trashed)select * from tree order by depth loop
 newid:=(m->>x.id::text)::uuid;
 if x.id<>p_id then insert into public.workspace_items(id,kind,owner_id,title,body,parent_id)values(newid,'note',auth.uid(),x.title,x.body-'allow_edit'-'mycel_parent',(m->>x.parent_id::text)::uuid);end if;
 insert into public.note_blocks(id,item_id,kind,content,position)select gen_random_uuid(),newid,kind,case when content ? '_rich' then jsonb_set(content,'{_rich}',public.workspace_clone_rich(content->'_rich',m))else content end,position from public.note_blocks where item_id=x.id and not deleted;
 update public.workspace_items set version=version+1 where id=newid;perform public.workspace_record(newid,'하위 노트 포함 독립 복사');
 end loop;return p_new;
end $$;
commit;
