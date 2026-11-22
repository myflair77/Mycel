begin;
-- Server-owned edit metadata; old blocks remain unknown until edited.
alter table public.note_blocks add column edited_at timestamptz;
alter table public.note_blocks add column edited_by uuid references public.profiles(id);
create function public.note_block_edit_stamp() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then new.edited_at:=now();new.edited_by:=auth.uid();
 elsif new.kind is distinct from old.kind or (new.content-'_layout') is distinct from (old.content-'_layout') then new.edited_at:=now();new.edited_by:=auth.uid();
 else new.edited_at:=old.edited_at;new.edited_by:=old.edited_by;end if;
 return new;
end $$;
create trigger note_block_edit_stamp before insert or update on public.note_blocks for each row execute function public.note_block_edit_stamp();
revoke all on function public.note_block_edit_stamp() from public,anon,authenticated;
create function public.page_block_info(p_block uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.note_blocks;root public.workspace_items;sync uuid;changed timestamptz;actor uuid;room uuid;
begin
 select * into b from public.note_blocks where id=p_block and not deleted;
 if b.id is null or auth.uid() is null or coalesce(public.workspace_permission(b.item_id),0)=0 or exists(select 1 from public.workspace_items where id=b.item_id and trashed) then raise exception '블록이 없거나 접근 권한이 없습니다.';end if;
 changed:=b.edited_at;actor:=b.edited_by;
 if b.content#>>'{_rich,type}'='syncedBlock' then
 sync:=(b.content#>>'{_rich,attrs,syncId}')::uuid;
 perform public.note_sync_get(b.item_id,sync);
 select r.created_at,r.actor into changed,actor from public.note_sync_revisions r where r.sync_id=sync order by r.version desc limit 1;
 if b.edited_at>changed then changed:=b.edited_at;actor:=b.edited_by;end if;
 end if;
 select * into root from public.workspace_items where id=public.workspace_root(b.item_id);
 if root.space_id is not null then room:=root.space_id;
 elsif root.owner_id=auth.uid() then select id into room from public.chat_rooms where direct_key='self:'||auth.uid()::text;
 else select s.room_id into room from public.workspace_shares s where s.item_id=root.id and public.workspace_permission(b.item_id,s.room_id)>0 limit 1;end if;
 return jsonb_build_object('id',b.id,'note_id',b.item_id,'room_id',room,'edited_at',changed,'editor',(select display_name from public.profiles where id=actor));
end $$;
create table public.block_move_receipts(actor uuid references public.profiles(id),mutation uuid,source uuid,target uuid,block_id uuid,version bigint,primary key(actor,mutation));
alter table public.block_move_receipts enable row level security;
revoke all on public.block_move_receipts from public,anon,authenticated;
create function public.page_block_move(p_source uuid,p_target uuid,p_block uuid,p_version bigint,p_target_version bigint,p_mutation uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare src public.workspace_items;dst public.workspace_items;b public.note_blocks;r public.block_move_receipts;x jsonb;child public.workspace_items;fid uuid;sid uuid;saved bigint;
begin
 perform pg_advisory_xact_lock(36736);
 perform 1 from public.workspace_items where id in(p_source,p_target) order by id for update;
 select * into src from public.workspace_items where id=p_source;select * into dst from public.workspace_items where id=p_target;
 if auth.uid() is null or p_mutation is null or p_source=p_target or src.kind is distinct from 'note' or dst.kind is distinct from 'note' or src.trashed or dst.trashed or coalesce(public.workspace_permission(p_source),0)<3 or coalesce(public.workspace_permission(p_target),0)<3 then raise exception '두 노트의 본문편집 권한을 확인해 주세요.';end if;
 select * into r from public.block_move_receipts where actor=auth.uid() and mutation=p_mutation;
 if found then if r.source=p_source and r.target=p_target and r.block_id=p_block then return r.version;else raise exception '다른 이동 요청입니다.';end if;end if;
 if src.version is distinct from p_version or dst.version is distinct from p_target_version then raise exception '다른 수정이 있습니다. 최신 내용을 확인하고 다시 이동해 주세요.';end if;
 select * into b from public.note_blocks where id=p_block and item_id=p_source and not deleted for update;
 if not found then raise exception '이동할 블록이 없습니다.';end if;
 if (select count(*) from public.note_blocks where item_id=p_target and not deleted)>=300 or (select coalesce(sum(octet_length(content::text)),0) from public.note_blocks where item_id=p_target and not deleted)+octet_length(b.content::text)>1900000 then raise exception '대상 노트의 크기 제한을 초과합니다.';end if;
 -- A room-scoped thread must never become visible to a different audience.
 if (public.workspace_root(p_source)<>public.workspace_root(p_target) or src.owner_id<>dst.owner_id) and exists(select 1 from public.workspace_comments where item_id=p_source and block_id=p_block) then raise exception '댓글이 있는 블록은 같은 상위 노트 안에서 이동해 주세요. 댓글 공개 범위가 달라질 수 있습니다.';end if;
 for x in select distinct value from jsonb_path_query(b.content,'$._rich.** ? (@.type == "childNote")') as found(value) loop
 select * into child from public.workspace_items where id=(x#>>'{attrs,noteId}')::uuid;
 if child.parent_id=p_source then perform public.workspace_child_move(child.id,p_target,child.version);
 elsif public.workspace_root(child.id)<>public.workspace_root(p_target) then raise exception '하위 노트는 같은 공유 범위 안에서 이동해 주세요.';end if;
 end loop;
 for x in select distinct value from jsonb_path_query(b.content,'$._rich.** ? (@.type == "noteFile")') as found(value) loop
 fid:=(x#>>'{attrs,fileId}')::uuid;
 if not exists(select 1 from public.note_file_links where item_id=p_source and file_id=fid) then raise exception '첨부파일 접근 권한을 확인해 주세요.';end if;
 insert into public.note_file_links values(p_target,fid)on conflict do nothing;
 end loop;
 for x in select distinct value from jsonb_path_query(b.content,'$._rich.** ? (@.type == "syncedBlock")') as found(value) loop
 sid:=(x#>>'{attrs,syncId}')::uuid;perform public.note_sync_link(p_target,sid);
 end loop;
 update public.note_blocks set item_id=p_target,content=content-'_layout',position=(select coalesce(max(position),-1)+1 from public.note_blocks where item_id=p_target),version=version+1 where id=p_block;
 with recursive thread as(select id from public.workspace_comments where item_id=p_source and block_id=p_block union select c.id from public.workspace_comments c join thread t on c.parent_id=t.id) update public.workspace_comments set item_id=p_target where id in(select id from thread);
 update public.workspace_items set version=version+1,updated_at=now() where id in(p_source,p_target);
 perform public.workspace_record(p_source,'블록 다른 노트로 이동');perform public.workspace_record(p_target,'블록 이동 받기');
 select version into saved from public.workspace_items where id=p_source;
 insert into public.block_move_receipts values(auth.uid(),p_mutation,p_source,p_target,p_block,saved);return saved;
end $$;
revoke all on function public.page_block_info(uuid),public.page_block_move(uuid,uuid,uuid,bigint,bigint,uuid) from public,anon;
grant execute on function public.page_block_info(uuid),public.page_block_move(uuid,uuid,uuid,bigint,bigint,uuid) to authenticated;
commit;
