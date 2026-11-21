begin;
create table public.note_sync_blocks(id uuid primary key,source_note uuid not null references public.workspace_items(id),content jsonb not null,version bigint not null default 1,created_by uuid not null references public.profiles(id),updated_at timestamptz not null default now());
create table public.note_sync_links(note_id uuid references public.workspace_items(id),sync_id uuid references public.note_sync_blocks(id),primary key(note_id,sync_id));
create table public.note_sync_revisions(sync_id uuid references public.note_sync_blocks(id),version bigint,mutation uuid not null,content jsonb not null,actor uuid not null references public.profiles(id),created_at timestamptz not null default now(),primary key(sync_id,version),unique(sync_id,mutation));
alter table public.note_sync_blocks enable row level security;
alter table public.note_sync_links enable row level security;
alter table public.note_sync_revisions enable row level security;
revoke all on public.note_sync_blocks,public.note_sync_links,public.note_sync_revisions from public,anon,authenticated;
create function public.note_sync_validate(p_content jsonb) returns void language plpgsql set search_path='' as $$
begin
 if p_content is null or p_content->>'type' is distinct from 'doc' or jsonb_typeof(p_content->'content') is distinct from 'array' or octet_length(p_content::text)>2097152 or jsonb_path_exists(p_content,'$.** ? (@.type == "syncedBlock")') then raise exception '동기화 내용 형식을 확인해 주세요. 동기화 블록 안에는 다른 동기화 블록을 넣을 수 없습니다.';end if;
end $$;
revoke all on function public.note_sync_validate(jsonb) from public,anon,authenticated;
create function public.note_sync_get(p_note uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.note_sync_blocks;source_perm int;target_perm int;
begin
 select * into s from public.note_sync_blocks where id=p_id;
 source_perm:=coalesce(public.workspace_permission(s.source_note),0);target_perm:=coalesce(public.workspace_permission(p_note),0);
 if auth.uid() is null or s.id is null or source_perm=0 or target_perm=0 or not exists(select 1 from public.note_sync_links where note_id=p_note and sync_id=p_id) then raise exception '원본 노트와 현재 노트에 대한 접근 권한이 필요합니다.';end if;
 return to_jsonb(s)||jsonb_build_object('permission',least(source_perm,target_perm),'source_title',(select title from public.workspace_items where id=s.source_note),'locations',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'title',i.title)),'[]') from public.note_sync_links l join public.workspace_items i on i.id=l.note_id where l.sync_id=p_id and public.workspace_permission(i.id)>0 and not i.trashed));
end $$;
create function public.note_sync_create(p_note uuid,p_id uuid,p_version bigint,p_blocks jsonb,p_content jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;s public.note_sync_blocks;
begin
 select * into i from public.workspace_items where id=p_note for update;
 if auth.uid() is null or i.kind is distinct from 'note' or i.trashed or coalesce(public.workspace_permission(p_note),0)<3 then raise exception '노트 편집 권한이 없습니다.';end if;
 select * into s from public.note_sync_blocks where id=p_id;
 if found then if s.source_note=p_note and s.created_by=auth.uid() then return i.version;else raise exception '이미 사용된 동기화 식별자입니다.';end if;end if;
 perform public.note_sync_validate(p_content);
 if not jsonb_path_exists(p_blocks,'$[*].content._rich.** ? (@.type == "syncedBlock" && @.attrs.syncId == $id)',jsonb_build_object('id',p_id::text)) then raise exception '동기화 블록 참조가 필요합니다.';end if;
 insert into public.note_sync_blocks(id,source_note,content,created_by)values(p_id,p_note,p_content,auth.uid());
 insert into public.note_sync_links values(p_note,p_id);
 insert into public.note_sync_revisions(sync_id,version,mutation,content,actor)values(p_id,1,p_id,p_content,auth.uid());
 return public.page_document_save(p_note,p_version,p_id,p_blocks);
end $$;
create function public.note_sync_link(p_note uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare source uuid;
begin
 select source_note into source from public.note_sync_blocks where id=p_id;
 if auth.uid() is null or coalesce(public.workspace_permission(source),0)=0 or coalesce(public.workspace_permission(p_note),0)<3 or not exists(select 1 from public.workspace_items where id=p_note and kind='note' and not trashed) then raise exception '원본 열람 권한과 현재 노트 편집 권한이 필요합니다.';end if;
 insert into public.note_sync_links values(p_note,p_id)on conflict do nothing;
 return public.note_sync_get(p_note,p_id);
end $$;
create function public.note_sync_save(p_note uuid,p_id uuid,p_version bigint,p_mutation uuid,p_content jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare s public.note_sync_blocks;prior bigint;
begin
 select * into s from public.note_sync_blocks where id=p_id for update;
 if (public.note_sync_get(p_note,p_id)->>'permission')::int<3 or exists(select 1 from public.workspace_items where id in(p_note,s.source_note) and trashed) then raise exception '원본과 현재 노트의 본문편집 권한이 필요합니다.';end if;
 select version into prior from public.note_sync_revisions where sync_id=p_id and mutation=p_mutation;
 if found then return prior;end if;
 if s.version is distinct from p_version then raise exception '다른 곳에서 수정되었습니다. 입력을 보관한 후 최신 내용을 확인해 주세요.';end if;
 perform public.note_sync_validate(p_content);
 update public.note_sync_blocks set content=p_content,version=version+1,updated_at=now() where id=p_id;
 insert into public.note_sync_revisions(sync_id,version,mutation,content,actor)values(p_id,p_version+1,p_mutation,p_content,auth.uid());
 -- The independent sync version prevents a nested edit from replacing its parent document.
 update public.workspace_items set updated_at=now() where id in(select note_id from public.note_sync_links where sync_id=p_id);
 return p_version+1;
end $$;
create function public.note_sync_history(p_note uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.note_sync_get(p_note,p_id);
 return (select coalesce(jsonb_agg(to_jsonb(r) order by version desc),'[]') from public.note_sync_revisions r where sync_id=p_id);
end $$;
revoke all on function public.note_sync_get(uuid,uuid),public.note_sync_create(uuid,uuid,bigint,jsonb,jsonb),public.note_sync_link(uuid,uuid),public.note_sync_save(uuid,uuid,bigint,uuid,jsonb),public.note_sync_history(uuid,uuid) from public,anon;
grant execute on function public.note_sync_get(uuid,uuid),public.note_sync_create(uuid,uuid,bigint,jsonb,jsonb),public.note_sync_link(uuid,uuid),public.note_sync_save(uuid,uuid,bigint,uuid,jsonb),public.note_sync_history(uuid,uuid) to authenticated;
-- Copies keep synced references, but readers still require the original note permission.
create function public.note_sync_copy_links() returns trigger language plpgsql security definer set search_path='' as $$
declare ref jsonb;sid uuid;
begin
 for ref in select jsonb_path_query(new.content,'$._rich.** ? (@.type == "syncedBlock").attrs.syncId') loop
 begin sid:=(ref#>>'{}')::uuid;exception when invalid_text_representation then continue;end;
 if exists(select 1 from public.note_sync_blocks where id=sid) and public.workspace_permission((select source_note from public.note_sync_blocks where id=sid))>0 then insert into public.note_sync_links values(new.item_id,sid)on conflict do nothing;end if;
 end loop;return new;
end $$;
revoke all on function public.note_sync_copy_links() from public,anon,authenticated;
create trigger note_sync_copy_links after insert or update of content on public.note_blocks for each row execute function public.note_sync_copy_links();
create function public.note_sync_detach(p_note uuid,p_id uuid,p_content jsonb) returns void language plpgsql security definer set search_path='' as $$
declare source uuid;ref jsonb;fid uuid;
begin
 source:=(public.note_sync_get(p_note,p_id)->>'source_note')::uuid;
 if public.workspace_permission(p_note)<3 then raise exception '현재 노트의 본문편집 권한이 필요합니다.';end if;
 perform public.note_sync_validate(p_content);
 for ref in select jsonb_path_query(p_content,'$.** ? (@.type == "noteFile").attrs.fileId') loop
 begin fid:=(ref#>>'{}')::uuid;exception when invalid_text_representation then continue;end;
 if exists(select 1 from public.note_file_links where item_id=source and file_id=fid) then insert into public.note_file_links values(p_note,fid)on conflict do nothing;end if;
 end loop;
end $$;
revoke all on function public.note_sync_detach(uuid,uuid,jsonb) from public,anon;
grant execute on function public.note_sync_detach(uuid,uuid,jsonb) to authenticated;
commit;
