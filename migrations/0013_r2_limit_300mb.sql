begin;
alter table public.chat_attachments drop constraint chat_attachments_size_check;
alter table public.chat_attachments add constraint chat_attachments_size_check check(size between 1 and 314572800);
-- Legacy Supabase bucket stays at 50MB. New files use R2.
create or replace function public.prepare_attachment(p_room uuid,p_id uuid,p_name text,p_size bigint,p_mime text) returns public.chat_attachments
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); a public.chat_attachments; peer uuid;
begin
 if actor is null or not public.is_room_member(p_room) then raise exception 'Room access denied' using errcode='42501'; end if;
 if p_id is null or p_name is null or char_length(p_name) not between 1 and 180 or p_name ~ '[[:cntrl:]]' or p_size is null or p_size not between 1 and 314572800 or p_mime is null or p_mime not in ('image/jpeg','image/png','image/gif','image/webp','application/octet-stream') then raise exception 'Invalid attachment'; end if;
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
commit;


