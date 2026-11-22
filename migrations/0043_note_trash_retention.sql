begin;
-- Timestamp actual trash transitions. Existing trash receives a fresh 30-day grace period.
alter table public.workspace_items add column trashed_at timestamptz;
update public.workspace_items set trashed_at=now() where trashed and kind='note';
create index workspace_trash_expiry on public.workspace_items(trashed_at) where trashed and kind='note';
create function public.workspace_trash_timestamp() returns trigger language plpgsql set search_path='' as $$
begin
 if new.kind='note' and new.trashed then
  if tg_op='INSERT' or not old.trashed then new.trashed_at:=now();else new.trashed_at:=old.trashed_at;end if;
 else new.trashed_at:=null;end if;return new;
end $$;
create trigger workspace_trash_timestamp before insert or update of trashed on public.workspace_items for each row execute function public.workspace_trash_timestamp();
revoke all on function public.workspace_trash_timestamp() from public,anon,authenticated;

create table public.note_file_deletions(id uuid primary key,r2_key text not null,size bigint not null,queued_at timestamptz not null default now());
alter table public.note_file_deletions enable row level security;
revoke all on public.note_file_deletions from public,anon,authenticated;

-- Internal removal shared by the explicit user action and the expiry job.
create function public.workspace_delete_notes_internal(p_ids uuid[]) returns integer language plpgsql security definer set search_path='' as $$
declare files uuid[];syncs uuid[];total integer;
begin
 perform pg_advisory_xact_lock(36736);
 perform 1 from public.workspace_items where id=any(p_ids) order by id for update;
 if exists(select 1 from public.workspace_items where id=any(p_ids) and (kind<>'note' or not trashed)) or exists(select 1 from public.workspace_items where parent_id=any(p_ids) and not id=any(p_ids)) then raise exception '휴지통 노트와 하위 노트를 다시 확인해 주세요.';end if;
 select array_agg(distinct file_id) into files from public.note_file_links where item_id=any(p_ids);
 select array_agg(id) into syncs from public.note_sync_blocks where source_note=any(p_ids);
 delete from public.push_jobs where mention_id in(select id from public.note_mention_notifications where note_id=any(p_ids) or sync_id=any(syncs));
 delete from public.note_mention_notifications where note_id=any(p_ids) or sync_id=any(syncs);
 delete from public.note_date_reminders where note_id=any(p_ids) or sync_id=any(syncs);
 delete from public.note_sync_links where note_id=any(p_ids) or sync_id=any(syncs);
 delete from public.note_sync_revisions where sync_id=any(syncs);
 delete from public.note_sync_blocks where id=any(syncs);
 delete from public.workspace_comment_history where comment_id in(select id from public.workspace_comments where item_id=any(p_ids));
 delete from public.workspace_comments where item_id=any(p_ids);
 delete from public.note_blocks where item_id=any(p_ids);
 delete from public.workspace_history where item_id=any(p_ids);
 delete from public.workspace_access where item_id=any(p_ids);
 delete from public.workspace_shares where item_id=any(p_ids);
 delete from public.workspace_library where item_id=any(p_ids);
 delete from public.page_save_receipts where item_id=any(p_ids);
 delete from public.workspace_reads where item_id=any(p_ids);
 if to_regclass('public.calendar_sync_records') is not null then execute 'delete from public.calendar_sync_records where item_id=any($1)' using p_ids;end if;
 -- Messages remain in the conversation, but their deleted resource link is removed.
 update public.messages set workspace_item_id=null,workspace_item_kind=null where workspace_item_id=any(p_ids);
 delete from public.note_file_links where item_id=any(p_ids);
 delete from public.workspace_items where id=any(p_ids);get diagnostics total=row_count;
 -- Shared files used by independent copies remain available.
 insert into public.note_file_deletions(id,r2_key,size) select id,r2_key,size from public.note_files f where id=any(files) and r2_key is not null and not exists(select 1 from public.note_file_links l where l.file_id=f.id) on conflict do nothing;
 delete from public.note_files f where id=any(files) and not exists(select 1 from public.note_file_links l where l.file_id=f.id);
 return total;
end $$;
revoke all on function public.workspace_delete_notes_internal(uuid[]) from public,anon,authenticated;

create function public.workspace_delete_preview(p_ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
 perform pg_advisory_xact_lock(36736);
 if auth.uid() is null or coalesce(cardinality(p_ids),0)=0 or cardinality(p_ids)>1000 then raise exception '삭제할 노트를 선택해 주세요.';end if;
 if exists(select 1 from unnest(p_ids) x where not exists(select 1 from public.workspace_items i where i.id=x and i.kind='note' and i.trashed and public.workspace_permission(i.id)=4)) then raise exception '휴지통 노트의 삭제 권한을 확인해 주세요.';end if;
 with recursive tree as(select id from public.workspace_items where id=any(p_ids) union select i.id from public.workspace_items i join tree t on i.parent_id=t.id) select array_agg(id) into ids from tree;
 if exists(select 1 from public.workspace_items where id=any(ids) and (not trashed or kind<>'note' or public.workspace_permission(id)<>4)) then raise exception '하위 노트의 상태와 삭제 권한을 확인해 주세요.';end if;
 return (select jsonb_agg(jsonb_build_object('id',id,'title',title,'version',version) order by id) from public.workspace_items where id=any(ids));
end $$;
create function public.workspace_delete_notes(p_items jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare ids uuid[];current_items jsonb;
begin
 perform pg_advisory_xact_lock(36736);
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then raise exception '삭제할 노트를 확인해 주세요.';end if;
 select array_agg((x->>'id')::uuid) into ids from jsonb_array_elements(p_items)x;
 current_items:=public.workspace_delete_preview(ids);
 if jsonb_array_length(current_items)<>jsonb_array_length(p_items) or exists(select 1 from jsonb_array_elements(current_items)c where not exists(select 1 from jsonb_array_elements(p_items)x where x->>'id'=c->>'id' and x->>'version'=c->>'version')) then raise exception '노트 상태가 변경되었습니다. 삭제 대상을 다시 확인해 주세요.';end if;
 return public.workspace_delete_notes_internal(ids);
end $$;
revoke all on function public.workspace_delete_preview(uuid[]),public.workspace_delete_notes(jsonb) from public,anon;
grant execute on function public.workspace_delete_preview(uuid[]),public.workspace_delete_notes(jsonb) to authenticated;

create function public.purge_expired_notes() returns integer language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
 perform pg_advisory_xact_lock(36736);
 -- Never delete a newer descendant early, even if a parent expires first.
 with recursive descendants as(select id ancestor,id,trashed,trashed_at from public.workspace_items where kind='note' union all select d.ancestor,i.id,i.trashed,i.trashed_at from descendants d join public.workspace_items i on i.parent_id=d.id),eligible as(select ancestor from descendants group by ancestor having bool_and(trashed and trashed_at is not null and trashed_at<=now()-interval '30 days')) select array_agg(id) into ids from public.workspace_items where id in(select ancestor from eligible);
 if ids is null then return 0;end if;return public.workspace_delete_notes_internal(ids);
end $$;
revoke all on function public.purge_expired_notes() from public,anon,authenticated;
grant execute on function public.purge_expired_notes() to service_role;
select cron.schedule('mycel-note-trash-retention','*/5 * * * *','select public.purge_expired_notes()');

create or replace function public.r2_cleanup_list(p_mac text) returns table(id uuid,r2_key text,size bigint) language plpgsql security definer set search_path='' as $$
begin
 if p_mac is null or p_mac<>public.r2_receipt_mac('retention-scan') then raise exception 'Access denied' using errcode='42501';end if;
 return query select q.id,q.r2_key,q.size from (select a.id,a.r2_key,a.size,a.expires_at due from public.chat_attachments a where a.r2_key is not null and a.expires_at<=now() and a.original_deleted_at is null union all select n.id,n.r2_key,n.size,n.queued_at from public.note_file_deletions n) q order by q.due limit 50;
end $$;
create or replace function public.r2_cleanup_done(p_id uuid,p_mac text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_mac is null or p_mac<>public.r2_receipt_mac('deleted:'||p_id::text) then raise exception 'Access denied' using errcode='42501';end if;
 update public.chat_attachments set original_deleted_at=now() where id=p_id and expires_at<=now() and r2_key is not null;
 delete from public.note_file_deletions where id=p_id;
end $$;
create or replace function public.dispatch_file_retention() returns void language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 if not exists(select 1 from public.chat_attachments where r2_key is not null and expires_at<=now() and original_deleted_at is null) and not exists(select 1 from public.note_file_deletions) then return;end if;
 select key_hex into secret from public.r2_receipt_secret where id=true;if secret is null then return;end if;
 perform net.http_post(url:='https://web-messenger-jbh.myflair.chatgpt.site/api/retention/run',headers:=jsonb_build_object('Content-Type','application/json','X-Retention-Key',secret),body:='{}'::jsonb,timeout_milliseconds:=60000);
end $$;
commit;
