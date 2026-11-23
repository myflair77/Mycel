begin;
-- Table anchors use the same persisted plain-text offsets and permission checks.
create or replace function public.page_quote_comment(p_id uuid,p_room uuid,p_comment uuid,p_body text,p_block uuid,p_version bigint,p_start integer,p_end integer,p_quote text) returns void language plpgsql security definer set search_path='' as $$
declare b public.note_blocks;
begin
 perform 1 from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id,p_room),0)<2 then raise exception '댓글 권한이 없습니다.';end if;
 select * into b from public.note_blocks where id=p_block and item_id=p_id and not deleted;
 if not found or b.version<>p_version or b.kind='divider' then raise exception '본문이 변경되었습니다. 문구를 다시 선택해 주세요.';end if;
 if p_start is null or p_end is null or p_start<0 or p_end<=p_start or p_end>char_length(b.content->>'text') or p_quote is null or substring(b.content->>'text' from p_start+1 for p_end-p_start)<>p_quote then raise exception '선택 문구를 확인해 주세요.';end if;
 if exists(select 1 from public.workspace_comments where id=p_comment) then raise exception '이미 등록된 댓글입니다.';end if;
 perform public.workspace_comment(p_id,p_room,p_comment,p_body,0,null,p_block);
 update public.workspace_comments set anchor=jsonb_build_object('quote',p_quote,'start',p_start,'end',p_end,'version',p_version,'prefix',right(left(b.content->>'text',p_start),24),'suffix',substring(b.content->>'text' from p_end+1 for 24)) where id=p_comment;
end $$;
revoke all on function public.page_quote_comment(uuid,uuid,uuid,text,uuid,bigint,integer,integer,text) from public,anon;
grant execute on function public.page_quote_comment(uuid,uuid,uuid,text,uuid,bigint,integer,integer,text) to authenticated;
commit;
