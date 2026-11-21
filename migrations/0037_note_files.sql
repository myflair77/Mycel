begin;
-- Permanent note attachments are separate from 30-day chat attachment retention.
create table public.note_files(id uuid primary key,owner_id uuid not null references public.profiles(id),name text not null,size bigint not null check(size>0 and size<=314572800),mime text not null,r2_key text,created_at timestamptz not null default now());
create table public.note_file_links(item_id uuid references public.workspace_items(id),file_id uuid references public.note_files(id),primary key(item_id,file_id));
alter table public.note_files enable row level security;
alter table public.note_file_links enable row level security;
revoke all on public.note_files,public.note_file_links from public,anon,authenticated;
create function public.prepare_note_file(p_note uuid,p_id uuid,p_name text,p_size bigint,p_mime text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.note_files;
begin
 perform 1 from public.workspace_items where id=p_note for update;
 if auth.uid() is null or coalesce(public.workspace_permission(p_note),0)<3 or not exists(select 1 from public.workspace_items where id=p_note and kind='note' and not trashed) then raise exception '노트 편집 권한이 없습니다.';end if;
 if p_name is null or char_length(p_name) not between 1 and 180 or p_size is null or p_size not between 1 and 314572800 or p_mime is null or p_mime not in ('application/octet-stream','image/jpeg','image/png','image/gif','image/webp') then raise exception '파일 이름, 크기 또는 형식을 확인해 주세요.';end if;
 select * into f from public.note_files where id=p_id;
 if found then
 if f.owner_id<>auth.uid() or f.name<>p_name or f.size<>p_size or f.mime<>p_mime or not exists(select 1 from public.note_file_links where item_id=p_note and file_id=p_id) then raise exception '파일 식별자가 이미 사용 중입니다.';end if;
 else
 if (select count(*) from public.note_files where owner_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then raise exception '파일을 너무 자주 추가했습니다. 잠시 후 다시 시도해 주세요.';end if;
 insert into public.note_files values(p_id,auth.uid(),p_name,p_size,p_mime,null,now()) returning * into f;
 insert into public.note_file_links values(p_note,p_id);
 end if;return to_jsonb(f)||jsonb_build_object('note_id',p_note);
end $$;
create function public.get_note_file(p_note uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.note_files;
begin
 if auth.uid() is null or coalesce(public.workspace_permission(p_note),0)=0 or not exists(select 1 from public.note_file_links where item_id=p_note and file_id=p_id) then raise exception '파일 접근 권한이 없습니다.';end if;
 select * into f from public.note_files where id=p_id;
 if f.r2_key is null and (f.owner_id<>auth.uid() or public.workspace_permission(p_note)<3) then raise exception '파일 업로드가 완료되지 않았습니다.';end if;
 return to_jsonb(f)||jsonb_build_object('note_id',p_note);
end $$;
create function public.finish_note_file(p_note uuid,p_id uuid,p_key text,p_receipt text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.note_files;
begin
 select * into f from public.note_files where id=p_id for update;
 if auth.uid() is null or f.owner_id is distinct from auth.uid() or coalesce(public.workspace_permission(p_note),0)<3 or not exists(select 1 from public.note_file_links l join public.workspace_items i on i.id=l.item_id where item_id=p_note and file_id=p_id and not i.trashed) then raise exception '파일 저장 권한이 없습니다.';end if;
 if p_key is null or p_key !~ ('^notes/'||p_id::text||'/[a-f0-9-]{36}/manifest.json$') or p_receipt is null or p_receipt<>public.r2_receipt_mac(p_id::text||':'||f.size::text||':'||p_key) then raise exception '파일 검증에 실패했습니다.';end if;
 if f.r2_key is not null and f.r2_key<>p_key then raise exception '이미 저장된 파일입니다.';end if;
 update public.note_files set r2_key=p_key where id=p_id;
 return public.get_note_file(p_note,p_id);
end $$;
revoke all on function public.prepare_note_file(uuid,uuid,text,bigint,text),public.get_note_file(uuid,uuid),public.finish_note_file(uuid,uuid,text,text) from public,anon;
grant execute on function public.prepare_note_file(uuid,uuid,text,bigint,text),public.get_note_file(uuid,uuid),public.finish_note_file(uuid,uuid,text,text) to authenticated;
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
 insert into public.note_file_links(item_id,file_id)select newid,file_id from public.note_file_links where item_id=x.id;
 update public.workspace_items set version=version+1 where id=newid;perform public.workspace_record(newid,'하위 노트 포함 독립 복사');
 end loop;return p_new;
end $$;
commit;
