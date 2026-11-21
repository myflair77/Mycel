begin;
alter table public.messages add column workspace_item_id uuid references public.workspace_items(id);
alter table public.messages add column workspace_item_kind text check(workspace_item_kind in ('note','event'));
create or replace function public.workspace_share(p_id uuid,p_room uuid,p_permission text,p_remove boolean default false) returns void language plpgsql security definer set search_path='' as $$
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
 update public.messages set workspace_item_id=p_id,workspace_item_kind=i.kind where id=m.id;
 insert into public.workspace_shares values(p_id,p_room,p_permission,m.sequence,i.version) on conflict(item_id,room_id) do update set permission=excluded.permission;
 end if;
 update public.workspace_items set version=version+1,updated_at=now() where id=p_id;perform public.workspace_record(p_id,'공유 설정 변경');
end $$;

-- Preserve original message bodies and identities; attach exact historical share references.
update public.messages m set workspace_item_id=s.item_id,workspace_item_kind=i.kind
from public.workspace_shares s join public.workspace_items i on i.id=s.item_id
where m.room_id=s.room_id and m.sequence=s.history_sequence;
create function public.workspace_copy_with_link(p_id uuid,p_new uuid,p_space uuid,p_permission text default 'read') returns uuid
language plpgsql security definer set search_path='' as $$
declare copied uuid;i public.workspace_items;
begin
 if p_space is null or p_permission not in ('read','comment','edit') then raise exception '대화방과 공유 권한을 선택해 주세요.';end if;
 perform public.assert_room_write(p_space);
 select * into i from public.workspace_items where id=p_new;
 if found then
 if i.owner_id=auth.uid() and i.space_id is null and exists(select 1 from public.workspace_shares where item_id=p_new and room_id=p_space and permission=p_permission) and exists(select 1 from public.messages where room_id=p_space and sender_id=auth.uid() and workspace_item_id=p_new) then return p_new;end if;
 raise exception '이미 사용된 식별자입니다.';
 end if;
 -- An independent copy shared with explicit ACL; room-manager roles cannot expand it.
 copied:=public.workspace_copy(p_id,p_new,null);
 perform public.workspace_share(copied,p_space,p_permission);
 return copied;
end $$;
revoke all on function public.workspace_copy_with_link(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.workspace_copy_with_link(uuid,uuid,uuid,text) to authenticated;
commit;
