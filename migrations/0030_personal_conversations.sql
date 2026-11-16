begin;
-- Keep existing room/resource identities. Retire the space-only product boundary.
alter table public.workspace_items drop constraint workspace_items_space_id_fkey;
alter table public.workspace_items add constraint workspace_items_space_id_fkey foreign key(space_id) references public.chat_rooms(id);
create table public.workspace_library(user_id uuid references auth.users(id),item_id uuid references public.workspace_items(id),primary key(user_id,item_id));
alter table public.workspace_library enable row level security;
revoke all on public.workspace_library from public,anon,authenticated;
create function public.workspace_library_set(p_id uuid,p_add boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(public.workspace_permission(p_id),0)=0 then raise exception '자료 접근 권한이 없습니다.';end if;
 if p_add then insert into public.workspace_library values(auth.uid(),p_id) on conflict do nothing;
 else delete from public.workspace_library where user_id=auth.uid() and item_id=p_id;end if;
end $$;
revoke all on function public.workspace_library_set(uuid,boolean) from public,anon;
grant execute on function public.workspace_library_set(uuid,boolean) to authenticated;
revoke execute on function public.create_space(uuid,text,uuid[]) from authenticated;
drop trigger guard_space_share on public.workspace_shares;
create or replace function public.workspace_permission(p_id uuid,p_room uuid default null) returns integer language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then 0 else greatest(
 case when i.space_id is null then case when i.owner_id=auth.uid() then 4 else 0 end
 when public.is_room_member(i.space_id) and (p_room is null or p_room=i.space_id) then
 case when public.group_manager(i.space_id) or (i.owner_id=auth.uid() and not exists(select 1 from public.collaboration_spaces where room_id=i.space_id)) then 4
 when i.trashed then 0 when i.owner_id=auth.uid() or i.body->>'allow_edit'='true' then 3 else 2 end else 0 end,
 case when i.trashed then 0 else coalesce((select max(case s.permission when 'edit' then 3 when 'comment' then 2 else 1 end) from public.workspace_shares s where s.item_id=i.id and (p_room is null or s.room_id=p_room) and public.can_read_chat_sequence(s.room_id,s.history_sequence)),0) end) end
 from public.workspace_items i where i.id=p_id
$$;
create or replace function public.create_space_item(p_id uuid,p_kind text,p_title text,p_body jsonb,p_space uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if p_space is not null then

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
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]') from (select i.*,public.workspace_permission(i.id,p_room) as permission,(select coalesce(jsonb_agg(jsonb_build_object('room_id',s.room_id,'permission',s.permission)),'[]') from public.workspace_shares s where s.item_id=i.id and (i.owner_id=auth.uid() or public.can_read_chat_sequence(s.room_id,s.history_sequence))) as shares from public.workspace_items i where i.kind=p_kind and coalesce(public.workspace_permission(i.id,p_room),0)>0 and ((p_room is null and ((i.space_id is null and i.owner_id=auth.uid()) or exists(select 1 from public.workspace_library l where l.item_id=i.id and l.user_id=auth.uid()))) or i.space_id=p_room or exists(select 1 from public.workspace_shares s where s.item_id=i.id and s.room_id=p_room and public.can_read_chat_sequence(s.room_id,s.history_sequence))))x);
end $$;
create or replace function public.propose_group_mode(p_room uuid,p_id uuid,p_mode text,p_candidate uuid,p_policy text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 return public.propose_group_mode_before_spaces(p_room,p_id,p_mode,p_candidate,p_policy);
end $$;
commit;
