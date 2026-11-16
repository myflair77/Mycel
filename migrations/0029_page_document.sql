begin;
create table public.page_save_receipts(item_id uuid references public.workspace_items(id),actor uuid references public.profiles(id),mutation uuid not null,version bigint not null,primary key(item_id,actor));
alter table public.page_save_receipts enable row level security;
revoke all on public.page_save_receipts from public,anon,authenticated;
create function public.page_document_save(p_id uuid,p_version bigint,p_mutation uuid,p_blocks jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;b jsonb;bid uuid;ids uuid[];saved bigint;c public.workspace_comments;candidate public.note_blocks;matches int;at int;txt text;q text;
begin
 select * into i from public.workspace_items where id=p_id for update;
 if coalesce(public.workspace_permission(p_id),0)<3 or i.trashed or i.kind<>'note' then raise exception '편집 권한이 없습니다.';end if;
 if p_mutation is null then raise exception '저장 요청을 확인해 주세요.';end if;
 select version into saved from public.page_save_receipts where item_id=p_id and actor=auth.uid() and mutation=p_mutation;
 if found then return saved;end if;
 if i.version is distinct from p_version then raise exception '다른 수정이 있습니다. 내 입력을 보관한 뒤 최신 내용을 확인해 주세요.';end if;
 if p_blocks is null or jsonb_typeof(p_blocks)<>'array' or jsonb_array_length(p_blocks)>300 or octet_length(p_blocks::text)>2000000 then raise exception '페이지 크기를 확인해 주세요.';end if;
 select coalesce(array_agg((value->>'id')::uuid),array[]::uuid[]) into ids from jsonb_array_elements(p_blocks);
 if cardinality(ids)<>(select count(distinct x) from unnest(ids)x) or array_position(ids,null) is not null then raise exception '블록 ID가 중복되었습니다.';end if;
 if exists(select 1 from public.note_blocks where id=any(ids) and item_id<>p_id) then raise exception '다른 페이지의 블록입니다.';end if;
 for b in select value from jsonb_array_elements(p_blocks) loop
 if coalesce(b->>'kind','') not in ('text','heading','list','check','quote','divider','table','link') or jsonb_typeof(b->'content') is distinct from 'object' or octet_length((b->'content')::text)>50000 then raise exception '블록 내용을 확인해 주세요.';end if;
 bid:=(b->>'id')::uuid;
 insert into public.note_blocks(id,item_id,kind,content,position) values(bid,p_id,b->>'kind',b->'content',array_position(ids,bid)-1)
 on conflict(id) do update set kind=excluded.kind,content=excluded.content,position=excluded.position,deleted=false,version=public.note_blocks.version+1
 where public.note_blocks.kind is distinct from excluded.kind or public.note_blocks.content is distinct from excluded.content or public.note_blocks.position<>excluded.position or public.note_blocks.deleted;
 end loop;
 update public.note_blocks set deleted=true,version=version+1 where item_id=p_id and not deleted and not(id=any(ids));
 for c in select * from public.workspace_comments where item_id=p_id and anchor is not null and not deleted loop
 q:=c.anchor->>'quote';if q is null or q='' then continue;end if;
 select * into candidate from public.note_blocks where id=c.block_id and not deleted;
 txt:=candidate.content->>'text';at:=strpos(coalesce(txt,''),q);matches:=0;
 if at>0 and strpos(substring(txt from at+char_length(q)),q)=0 then matches:=1;
 else
 select count(*) into matches from public.note_blocks where item_id=p_id and not deleted and strpos(coalesce(content->>'text',''),q)>0;
 if matches=1 then
 select * into candidate from public.note_blocks where item_id=p_id and not deleted and strpos(coalesce(content->>'text',''),q)>0;
 txt:=candidate.content->>'text';at:=strpos(txt,q);
 if strpos(substring(txt from at+char_length(q)),q)>0 then matches:=0;end if;
 end if;end if;
 if matches=1 then update public.workspace_comments set block_id=candidate.id,anchor=c.anchor||jsonb_build_object('start',at-1,'end',at-1+char_length(q),'version',candidate.version,'prefix',right(left(txt,at-1),24),'suffix',substring(txt from at+char_length(q) for 24)) where id=c.id;end if;
 end loop;
 update public.workspace_items set version=version+1,updated_at=now() where id=p_id returning version into saved;
 perform public.workspace_record(p_id,'페이지 편집');
 insert into public.page_save_receipts values(p_id,auth.uid(),p_mutation,saved) on conflict(item_id,actor) do update set mutation=excluded.mutation,version=excluded.version;
 return saved;
end $$;
revoke all on function public.page_document_save(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.page_document_save(uuid,bigint,uuid,jsonb) to authenticated;
commit;
