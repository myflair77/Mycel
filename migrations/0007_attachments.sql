-- Private, immutable attachments. Existing text messages and history are unchanged.
begin;
create table public.chat_attachments (
 id uuid primary key,
 room_id uuid not null references public.chat_rooms(id),
 sender_id uuid not null references public.profiles(id),
 name text not null check(char_length(name) between 1 and 180),
 size bigint not null check(size between 1 and 10485760),
 mime text not null check(mime in ('image/jpeg','image/png','image/gif','image/webp','application/octet-stream')),
 path text not null unique,
 created_at timestamptz not null default now()
);
create index chat_attachments_sender_time on public.chat_attachments(sender_id,created_at);
alter table public.messages add column attachment_id uuid unique references public.chat_attachments(id);
alter table public.chat_attachments enable row level security;
revoke all on public.chat_attachments from public,anon,authenticated;
grant select on public.chat_attachments to authenticated;
create policy attachment_metadata_read on public.chat_attachments for select to authenticated using (
 sender_id=auth.uid() or (public.is_room_member(room_id) and exists(select 1 from public.messages m where m.attachment_id=chat_attachments.id))
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-files','chat-files',false,10485760,array['image/jpeg','image/png','image/gif','image/webp','application/octet-stream']);
create function public.can_use_chat_file(p_path text,p_write boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chat_attachments a where a.path=p_path and public.is_room_member(a.room_id) and
 case when p_write then a.sender_id=auth.uid() and not exists(select 1 from public.messages m where m.attachment_id=a.id)
 and not exists(select 1 from public.chat_members cm where cm.room_id=a.room_id and cm.user_id<>auth.uid() and public.social_blocked(auth.uid(),cm.user_id))
 else a.sender_id=auth.uid() or exists(select 1 from public.messages m where m.attachment_id=a.id) end);
$$;
revoke all on function public.can_use_chat_file(text,boolean) from public,anon;
grant execute on function public.can_use_chat_file(text,boolean) to authenticated;
create policy chat_files_insert on storage.objects for insert to authenticated with check(bucket_id='chat-files' and public.can_use_chat_file(name,true));
create policy chat_files_read on storage.objects for select to authenticated using(bucket_id='chat-files' and public.can_use_chat_file(name,false));
-- No update/delete policy: an already sent attachment cannot be overwritten.
create function public.prepare_attachment(p_room uuid,p_id uuid,p_name text,p_size bigint,p_mime text) returns public.chat_attachments
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); a public.chat_attachments; peer uuid;
begin
 if actor is null or not public.is_room_member(p_room) then raise exception 'Room access denied' using errcode='42501'; end if;
 if p_id is null or p_name is null or char_length(p_name) not between 1 and 180 or p_name ~ '[[:cntrl:]]' or p_size is null or p_size not between 1 and 10485760 or p_mime is null or p_mime not in ('image/jpeg','image/png','image/gif','image/webp','application/octet-stream') then raise exception 'Invalid attachment'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select user_id into peer from public.chat_members where room_id=p_room and user_id<>actor;
 perform public.social_pair_lock(actor,peer);
 if public.social_blocked(actor,peer) then raise exception '차단 상태에서는 파일을 보낼 수 없습니다.' using errcode='42501'; end if;
 select * into a from public.chat_attachments where id=p_id;
 if found then
  if a.sender_id<>actor or a.room_id<>p_room or a.name<>p_name or a.size<>p_size or a.mime<>p_mime then raise exception 'Attachment conflict'; end if;
  return a;
 end if;
 if (select count(*) from public.chat_attachments where sender_id=actor and created_at>now()-interval '1 hour')>=20 then raise exception '파일은 1시간에 20개까지 보낼 수 있습니다.'; end if;
 insert into public.chat_attachments(id,room_id,sender_id,name,size,mime,path) values(p_id,p_room,actor,p_name,p_size,p_mime,actor::text||'/'||p_id::text) returning * into a;
 return a;
end $$;
create function public.send_attachment(p_id uuid) returns public.messages
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); a public.chat_attachments; saved public.messages; peer uuid; next_seq bigint; metadata jsonb;
begin
 select * into a from public.chat_attachments where id=p_id;
 if actor is null or a.id is null or a.sender_id<>actor or not public.is_room_member(a.room_id) then raise exception 'Attachment access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select user_id into peer from public.chat_members where room_id=a.room_id and user_id<>actor;
 perform public.social_pair_lock(actor,peer);
 -- Retrying a committed attachment is harmless, even if a later block exists.
 select * into saved from public.messages where sender_id=actor and idempotency_key=p_id;
 if found then
  if saved.attachment_id is distinct from p_id then raise exception 'Idempotency conflict'; end if;
  return saved;
 end if;
 if public.social_blocked(actor,peer) then raise exception '차단 상태에서는 파일을 보낼 수 없습니다.' using errcode='42501'; end if;
 select o.metadata into metadata from storage.objects o where o.bucket_id='chat-files' and o.name=a.path;
 if metadata is null or (metadata->>'size')::bigint is distinct from a.size or (metadata->>'mimetype') is distinct from a.mime then raise exception '파일 업로드를 완료한 후 다시 전송해 주세요.'; end if;
 if (select count(*) from public.messages where sender_id=actor and created_at>now()-interval '1 minute')>=60 then raise exception 'Message rate limit'; end if;
 update public.chat_rooms set last_sequence=last_sequence+1 where id=a.room_id returning last_sequence into next_seq;
 insert into public.messages(room_id,sender_id,body,idempotency_key,sequence,attachment_id) values(a.room_id,actor,a.name,p_id,next_seq,p_id) returning * into saved;
 return saved;
end $$;
revoke all on function public.prepare_attachment(uuid,uuid,text,bigint,text),public.send_attachment(uuid) from public,anon;
grant execute on function public.prepare_attachment(uuid,uuid,text,bigint,text),public.send_attachment(uuid) to authenticated;
commit;
