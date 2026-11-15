begin;
create function public.page_block_reorder(p_id uuid,p_version bigint,p_order uuid[],p_layout jsonb) returns void language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;actual uuid[];
begin
 select * into i from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id),0)<3 or i.trashed then raise exception '편집 권한이 없습니다.';end if;
 if i.version<>p_version then raise exception '다른 수정이 있습니다. 최신 순서를 확인해 주세요.';end if;
 select coalesce(array_agg(id order by id),array[]::uuid[]) into actual from public.note_blocks where item_id=p_id and not deleted;
 if p_order is null or cardinality(p_order)<>cardinality(actual) or (select array_agg(x order by x) from unnest(p_order)x) is distinct from (select array_agg(x order by x) from unnest(actual)x) then raise exception '블록 목록이 변경되었습니다.';end if;
 update public.note_blocks b set position=o.n-1 from unnest(p_order) with ordinality o(id,n) where b.id=o.id and b.item_id=p_id;
 if p_layout is null or jsonb_typeof(p_layout)<>'object' or octet_length(p_layout::text)>200000 then raise exception '열 배치를 확인해 주세요.';end if;
 if exists(select 1 from jsonb_each(p_layout) e where not(e.key=any(select x::text from unnest(actual)x)) or jsonb_typeof(e.value)<>'object' or coalesce(e.value->>'group','')!~'^[0-9a-f-]{36}$' or coalesce(e.value->>'column','')!~'^[0-3]$' or coalesce(e.value->>'width','')!~'^[0-9]+([.][0-9]+)?$') then raise exception '열 배치 값이 올바르지 않습니다.';end if;
 if exists(select 1 from jsonb_each(p_layout)e where (e.value->>'width')::numeric<15 or (e.value->>'width')::numeric>100) then raise exception '열 너비를 확인해 주세요.';end if;
 update public.note_blocks b set content=case when p_layout ? b.id::text then jsonb_set(b.content,'{_layout}',p_layout->b.id::text) else b.content-'_layout' end where b.item_id=p_id and not b.deleted;
 update public.workspace_items set version=version+1,updated_at=now() where id=p_id;
 perform public.workspace_record(p_id,'블록 드래그 이동');
end $$;
alter table public.workspace_comments add column anchor jsonb;
create or replace function public.record_workspace_comment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.version=old.version then return new;end if;
 insert into public.workspace_comment_history(comment_id,version,body,resolved,deleted) values(new.id,new.version,new.body,new.resolved,new.deleted);return new;
end $$;
create function public.page_quote_comment(p_id uuid,p_room uuid,p_comment uuid,p_body text,p_block uuid,p_version bigint,p_start integer,p_end integer,p_quote text) returns void language plpgsql security definer set search_path='' as $$
declare b public.note_blocks;
begin
 perform 1 from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id,p_room),0)<2 then raise exception '댓글 권한이 없습니다.';end if;
 select * into b from public.note_blocks where id=p_block and item_id=p_id and not deleted;
 if not found or b.version<>p_version or b.kind in ('table','divider') then raise exception '본문이 변경되었습니다. 문구를 다시 선택해 주세요.';end if;
 if p_start is null or p_end is null or p_start<0 or p_end<=p_start or p_end>char_length(b.content->>'text') or p_quote is null or substring(b.content->>'text' from p_start+1 for p_end-p_start)<>p_quote then raise exception '선택 문구를 확인해 주세요.';end if;
 if exists(select 1 from public.workspace_comments where id=p_comment) then raise exception '이미 등록된 댓글입니다.';end if;
 perform public.workspace_comment(p_id,p_room,p_comment,p_body,0,null,p_block);
 update public.workspace_comments set anchor=jsonb_build_object('quote',p_quote,'start',p_start,'end',p_end,'version',p_version,'prefix',right(left(b.content->>'text',p_start),24),'suffix',substring(b.content->>'text' from p_end+1 for 24)) where id=p_comment;
end $$;
revoke all on function public.page_block_reorder(uuid,bigint,uuid[],jsonb),public.page_quote_comment(uuid,uuid,uuid,text,uuid,bigint,integer,integer,text) from public,anon;
grant execute on function public.page_block_reorder(uuid,bigint,uuid[],jsonb),public.page_quote_comment(uuid,uuid,uuid,text,uuid,bigint,integer,integer,text) to authenticated;
commit;
