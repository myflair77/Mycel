begin;
-- Read-only suggestions. The note and its publication scope are verified server-side.
create function public.page_mention_targets(p_note uuid,p_room uuid default null,p_query text default '',p_target uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare source public.workspace_items; root public.workspace_items; scope uuid; people jsonb; notes jsonb;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 select * into source from public.workspace_items where id=p_note;
 select * into root from public.workspace_items where id=public.workspace_root(p_note);
 scope:=coalesce(p_room,root.space_id);
 if source.kind is distinct from 'note' or source.trashed or root.trashed or coalesce(public.workspace_permission(p_note,scope),0)=0 then raise exception '노트 접근 권한이 없습니다.';end if;
 if scope is not null and (not public.is_room_member(scope) or not (coalesce(root.space_id=scope,false) or exists(select 1 from public.workspace_shares s where s.item_id=root.id and s.room_id=scope and public.can_read_chat_sequence(scope,s.history_sequence)))) then raise exception '이 노트가 게시된 공간에서만 언급할 수 있습니다.';end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into people from (select p.id,p.display_name as label,p.username from public.chat_members m join public.profiles p on p.id=m.user_id where m.room_id=scope and (p_target is null or p.id=p_target) and (p_target is not null or position(lower(left(coalesce(p_query,''),100)) in lower(p.display_name||' '||p.username))>0) order by p.display_name,p.id limit 50)x;
 with recursive visible as (
 select i.id,i.parent_id,i.title,i.body from public.workspace_items i where i.kind='note' and i.parent_id is null and not i.trashed and public.workspace_permission(i.id,scope)>0 and
 (case when scope is null then i.space_id is null and i.owner_id=auth.uid() else i.space_id=scope or exists(select 1 from public.workspace_shares s where s.item_id=i.id and s.room_id=scope and public.can_read_chat_sequence(scope,s.history_sequence)) end)
 union all select i.id,i.parent_id,i.title,i.body from public.workspace_items i join visible v on i.parent_id=v.id where i.kind='note' and not i.trashed and public.workspace_permission(i.id,scope)>0
 ) select coalesce(jsonb_agg(to_jsonb(x)),'[]') into notes from (select id,title as label,body->>'icon' as icon from visible where (p_target is null or id=p_target) and (p_target is not null or position(lower(left(coalesce(p_query,''),100)) in lower(title))>0) order by title,id limit 30)x;
 return jsonb_build_object('room',scope,'people',people,'notes',notes);
end $$;
revoke all on function public.page_mention_targets(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.page_mention_targets(uuid,uuid,text,uuid) to authenticated;
commit;
