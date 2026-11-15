begin;
-- Insert adjacent blocks atomically, retaining existing block identities and history.
create function public.page_block_insert(p_id uuid,p_block uuid,p_after uuid,p_kind text,p_content jsonb) returns void language plpgsql security definer set search_path='' as $$
declare pos integer;
begin
 perform 1 from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id),0)<3 then raise exception '편집 권한이 없습니다.';end if;
 if exists(select 1 from public.note_blocks where id=p_block) then raise exception '이미 사용된 블록입니다.';end if;
 if p_after is not null then
  select position into pos from public.note_blocks where id=p_after and item_id=p_id and not deleted;
  if not found then raise exception '삽입 위치가 변경되었습니다. 다시 확인해 주세요.';end if;
 else select coalesce(max(position),-1) into pos from public.note_blocks where item_id=p_id;end if;
 perform public.note_block_save(p_id,p_block,0,p_kind,p_content,false);
 update public.note_blocks set position=position+1 where item_id=p_id and id<>p_block and position>pos;
 update public.note_blocks set position=pos+1 where id=p_block;
 -- Correct the just-created revision to include the final atomic placement.
 update public.workspace_history set snapshot=public.workspace_snapshot(p_id),action='블록 추가' where item_id=p_id and revision=(select version from public.workspace_items where id=p_id);
end $$;
revoke all on function public.page_block_insert(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.page_block_insert(uuid,uuid,uuid,text,jsonb) to authenticated;
commit;
