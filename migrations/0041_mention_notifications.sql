begin;
create table public.note_mention_notifications(
 id uuid primary key, recipient uuid not null references public.profiles(id), actor uuid not null references public.profiles(id),
 note_id uuid not null references public.workspace_items(id), room_id uuid not null references public.chat_rooms(id),
 sync_id uuid references public.note_sync_blocks(id), created_at timestamptz not null default now(),read_at timestamptz
);
create index note_mention_inbox on public.note_mention_notifications(recipient,created_at desc);
alter table public.note_mention_notifications enable row level security;
revoke all on public.note_mention_notifications from public,anon,authenticated;
grant all on public.note_mention_notifications to service_role;
alter table public.push_jobs alter column message_id drop not null;
alter table public.push_jobs add column mention_id uuid references public.note_mention_notifications(id);
alter table public.push_jobs add constraint push_job_target check(num_nonnulls(message_id,mention_id)=1);
create unique index push_mention_device on public.push_jobs(mention_id,device_id) where mention_id is not null;

-- Reuse the existing permission rules for the recipient, and always restore the caller.
-- Internal only: no client may choose an identity for a permission check.
create function public.note_mention_access(p_user uuid,p_note uuid,p_room uuid,p_sync uuid default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare previous text:=current_setting('request.jwt.claim.sub',true); permitted boolean;root public.workspace_items;
begin
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 select * into root from public.workspace_items where id=public.workspace_root(p_note);
 permitted:=public.is_room_member(p_room) and public.workspace_permission(p_note,p_room)>0
 and (root.space_id=p_room or exists(select 1 from public.workspace_shares where item_id=root.id and room_id=p_room and public.can_read_chat_sequence(p_room,history_sequence)))
 and not exists(with recursive chain as(select id,parent_id,trashed from public.workspace_items where id=p_note union all select i.id,i.parent_id,i.trashed from public.workspace_items i join chain c on c.parent_id=i.id)select 1 from chain where trashed);
 if p_sync is not null then permitted:=permitted and exists(select 1 from public.note_sync_blocks s where s.id=p_sync and public.workspace_permission(s.source_note)>0 and not exists(select 1 from public.workspace_items where id in(s.source_note,public.workspace_root(s.source_note)) and trashed));end if;
 perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);return coalesce(permitted,false);
exception when others then perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);raise;
end $$;
revoke all on function public.note_mention_access(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create function public.record_note_mentions(p_note uuid,p_content jsonb,p_sync uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare node jsonb;mid uuid;person uuid;room uuid;inserted uuid;actor uuid:=auth.uid();
begin
 if actor is null or coalesce(public.workspace_permission(p_note),0)<3 then return;end if;
 for node in select distinct q.value from jsonb_path_query(p_content,'$.** ? (@.type == "pageMention" && @.attrs.kind == "person")') as q(value) loop
 begin mid:=(node->'attrs'->>'mentionId')::uuid;person:=(node->'attrs'->>'target')::uuid;room:=(node->'attrs'->>'roomId')::uuid;exception when invalid_text_representation then continue;end;
 if mid is null or person is null or room is null or person=actor or public.social_blocked(actor,person) then continue;end if;
 if not public.note_mention_access(actor,p_note,room,p_sync) or not public.note_mention_access(person,p_note,room,p_sync) then continue;end if;
 insert into public.note_mention_notifications(id,recipient,actor,note_id,room_id,sync_id)values(mid,person,actor,p_note,room,p_sync)on conflict do nothing returning id into inserted;
 if inserted is not null then
 insert into public.push_jobs(mention_id,device_id) select inserted,d.id from public.push_devices d where d.user_id=person
 and not exists(select 1 from public.room_preferences where room_id=room and user_id=person and muted)on conflict do nothing;
 end if;
 end loop;
end $$;
revoke all on function public.record_note_mentions(uuid,jsonb,uuid) from public,anon,authenticated;
alter function public.page_document_save(uuid,bigint,uuid,jsonb) rename to page_document_save_before_mentions;
revoke all on function public.page_document_save_before_mentions(uuid,bigint,uuid,jsonb) from public,anon,authenticated;
create function public.page_document_save(p_id uuid,p_version bigint,p_mutation uuid,p_blocks jsonb)returns bigint
language plpgsql security definer set search_path='' as $$
declare saved bigint;
begin saved:=public.page_document_save_before_mentions(p_id,p_version,p_mutation,p_blocks);
 -- Scan persisted content, never a stale retry payload.
 perform public.record_note_mentions(p_id,(select coalesce(jsonb_agg(content),'[]')from public.note_blocks where item_id=p_id and not deleted));return saved;end $$;
grant execute on function public.page_document_save(uuid,bigint,uuid,jsonb) to authenticated;
revoke all on function public.page_document_save(uuid,bigint,uuid,jsonb) from public,anon;
alter function public.note_sync_save(uuid,uuid,bigint,uuid,jsonb) rename to note_sync_save_before_mentions;
revoke all on function public.note_sync_save_before_mentions(uuid,uuid,bigint,uuid,jsonb) from public,anon,authenticated;
create function public.note_sync_save(p_note uuid,p_id uuid,p_version bigint,p_mutation uuid,p_content jsonb)returns bigint
language plpgsql security definer set search_path='' as $$
declare saved bigint;
begin saved:=public.note_sync_save_before_mentions(p_note,p_id,p_version,p_mutation,p_content);perform public.record_note_mentions(p_note,(select content from public.note_sync_blocks where id=p_id),p_id);return saved;end $$;
revoke all on function public.note_sync_save(uuid,uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.note_sync_save(uuid,uuid,bigint,uuid,jsonb) to authenticated;

-- Resolve against current content, including moved blocks, and recheck permissions.
create function public.note_mention_location(p_id uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.note_mention_notifications;b public.note_blocks;
begin
 select * into n from public.note_mention_notifications where id=p_id;if not found then return null;end if;
 if public.social_blocked(n.actor,n.recipient) then return null;end if;
 if n.sync_id is null then
 select * into b from public.note_blocks where not deleted and jsonb_path_exists(content,'$.** ? (@.type == "pageMention" && @.attrs.mentionId == $id && @.attrs.target == $person)',jsonb_build_object('id',n.id::text,'person',n.recipient::text)) and public.note_mention_access(n.recipient,item_id,n.room_id) order by (item_id=n.note_id) desc limit 1;
 else
 if not exists(select 1 from public.note_sync_blocks where id=n.sync_id and jsonb_path_exists(content,'$.** ? (@.type == "pageMention" && @.attrs.mentionId == $id && @.attrs.target == $person)',jsonb_build_object('id',n.id::text,'person',n.recipient::text)))then return null;end if;
 select * into b from public.note_blocks where item_id=n.note_id and not deleted and jsonb_path_exists(content,'$.** ? (@.type == "syncedBlock" && @.attrs.syncId == $id)',jsonb_build_object('id',n.sync_id::text)) and public.note_mention_access(n.recipient,item_id,n.room_id,n.sync_id) limit 1;
 end if;
 if b.id is null then return null;end if;
 return jsonb_build_object('note_id',b.item_id,'block_id',b.id,'room_id',n.room_id,'mention_id',n.id);
end $$;
revoke all on function public.note_mention_location(uuid) from public,anon,authenticated;
create function public.note_mentions_inbox()returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 select coalesce(jsonb_agg(x order by x.created_at desc),'[]')into result from(
 select n.id,n.created_at,n.read_at,p.display_name as actor_name,(select title from public.workspace_items where id=(loc->>'note_id')::uuid)as note_title
 from (select * from public.note_mention_notifications where recipient=auth.uid() order by created_at desc limit 100)n
 join public.profiles p on p.id=n.actor cross join lateral(select public.note_mention_location(n.id)as loc)l where loc is not null)x;
 return result;
end $$;
create function public.note_mention_open(p_id uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare target jsonb;
begin
 if not exists(select 1 from public.note_mention_notifications where id=p_id and recipient=auth.uid())then raise exception '알림 접근 권한이 없습니다.';end if;
 target:=public.note_mention_location(p_id);if target is null then raise exception '언급이 삭제되었거나 노트 접근 권한이 변경되었습니다.';end if;
 update public.note_mention_notifications set read_at=coalesce(read_at,now())where id=p_id;return target;
end $$;
revoke all on function public.note_mentions_inbox(),public.note_mention_open(uuid) from public,anon;
grant execute on function public.note_mentions_inbox(),public.note_mention_open(uuid) to authenticated;

create or replace function public.claim_push_jobs()returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with picked as(select j.id from public.push_jobs j where status='pending' and next_attempt<=now()and attempts<6 and created_at>now()-interval '1 day'order by j.id for update skip locked limit 30),
 claimed as(update public.push_jobs j set attempts=attempts+1,next_attempt=now()+interval '90 seconds'from picked where j.id=picked.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'attempts',j.attempts,'device_id',d.id,'endpoint',d.endpoint,'p256dh',d.p256dh,'auth',d.auth,'room_id',coalesce(m.room_id,n.room_id),'user_id',d.user_id,'mention_id',n.id,
 'skip',case when j.mention_id is not null then n.id is null or n.recipient<>d.user_id or n.read_at is not null or public.note_mention_location(n.id)is null
 else m.id is null or public.social_blocked(m.sender_id,d.user_id)or coalesce(d.active_room=m.room_id and d.active_until>now(),false)end
 or exists(select 1 from public.room_preferences pref where pref.room_id=coalesce(m.room_id,n.room_id)and pref.user_id=d.user_id and pref.muted))),'[]')into result
 from claimed j join public.push_devices d on d.id=j.device_id left join public.messages m on m.id=j.message_id left join public.note_mention_notifications n on n.id=j.mention_id;
 return result;
end $$;
commit;
