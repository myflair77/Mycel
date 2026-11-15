begin;
-- Existing members retain their previously available history. Future joins get a floor.
alter table public.chat_members add column visible_after_sequence bigint not null default 0;
create function public.set_group_history_floor() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.chat_rooms where id=new.room_id and group_name is not null) then
  select last_sequence into new.visible_after_sequence from public.chat_rooms where id=new.room_id for update;
 end if;
 return new;
end $$;
create trigger set_group_history_floor before insert on public.chat_members for each row execute function public.set_group_history_floor();
create function public.can_read_chat_sequence(p_room uuid,p_sequence bigint) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chat_members where room_id=p_room and user_id=auth.uid() and p_sequence>visible_after_sequence);
$$;
alter table public.room_posts add column history_sequence bigint not null default 0;
update public.room_posts p set history_sequence=coalesce((select min(m.sequence) from public.messages m where m.post_id=p.id),0);
create function public.set_post_history_sequence() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select last_sequence+1 into new.history_sequence from public.chat_rooms where id=new.room_id for update;
 return new;
end $$;
create trigger set_post_history_sequence before insert on public.room_posts for each row execute function public.set_post_history_sequence();
create function public.can_read_room_post(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.room_posts p join public.chat_members m on m.room_id=p.room_id and m.user_id=auth.uid() where p.id=p_id and (m.visible_after_sequence=0 or p.history_sequence>m.visible_after_sequence));
$$;
alter policy messages_read on public.messages using(public.can_read_chat_sequence(room_id,sequence));
alter policy posts_read on public.room_posts using(public.can_read_room_post(id));
alter policy flags_read on public.message_flags using(user_id=auth.uid() and exists(select 1 from public.messages m where m.id=message_id and public.can_read_chat_sequence(m.room_id,m.sequence)));
create or replace function public.can_read_attachment(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.chat_attachments a where a.id=p_id and (
 (a.sender_id=auth.uid() and exists(select 1 from public.chat_rooms where id=a.room_id and group_name is null))
 or (a.sender_id=auth.uid() and public.is_room_member(a.room_id) and not exists(select 1 from public.messages where attachment_id=a.id))
 or exists(select 1 from public.messages m where m.attachment_id=a.id and m.deleted_at is null and public.can_read_chat_sequence(m.room_id,m.sequence))
 or exists(select 1 from public.room_posts p where a.id=any(p.attachments) and p.deleted_at is null and public.can_read_room_post(p.id))));
$$;
create function public.create_group_from_direct(p_direct uuid,p_key uuid,p_name text,p_users uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare peer uuid;ids uuid[];
begin
 if auth.uid() is null or not public.is_room_member(p_direct) or not exists(select 1 from public.chat_rooms where id=p_direct and group_name is null and self_owner is null) then raise exception '1:1 대화에 접근할 수 없습니다.';end if;
 select user_id into peer from public.chat_members where room_id=p_direct and user_id<>auth.uid();
 select array_agg(distinct x) into ids from unnest(p_users) x where x is not null and x<>auth.uid() and x<>peer;
 if peer is null or coalesce(cardinality(ids),0)<1 then raise exception '추가할 친구를 선택해 주세요.';end if;
 return public.create_group_chat(p_key,p_name,array_append(ids,peer));
end $$;
revoke all on function public.set_group_history_floor(),public.set_post_history_sequence() from public,anon,authenticated;
revoke all on function public.can_read_chat_sequence(uuid,bigint),public.can_read_room_post(uuid),public.create_group_from_direct(uuid,uuid,text,uuid[]) from public,anon;
grant execute on function public.can_read_chat_sequence(uuid,bigint),public.can_read_room_post(uuid),public.create_group_from_direct(uuid,uuid,text,uuid[]) to authenticated;

create or replace function public.prepare_message_reply(p_key uuid,p_room uuid,p_reply uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_room_write(p_room);
 if exists(select 1 from public.message_compositions where user_id=auth.uid() and send_key=p_key and room_id=p_room and reply_to is not distinct from p_reply) then return;end if;
 if p_reply is not null and not exists(select 1 from public.messages where id=p_reply and room_id=p_room and deleted_at is null and public.can_read_chat_sequence(room_id,sequence)) then raise exception '답장할 원문이 없거나 삭제되었습니다.';end if;
 insert into public.message_compositions values(auth.uid(),p_key,p_room,p_reply) on conflict(user_id,send_key) do nothing;
 if not exists(select 1 from public.message_compositions where user_id=auth.uid() and send_key=p_key and room_id=p_room and reply_to is not distinct from p_reply) then raise exception 'Idempotency conflict';end if;
end $$;

create or replace function public.set_message_flag(p_id uuid,p_kind text,p_value boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.messages where id=p_id and public.can_read_chat_sequence(room_id,sequence)) or auth.uid() is null then raise exception 'Message access denied';end if;
 if p_kind not in ('hidden','starred') or p_value is null then raise exception 'Invalid flag';end if;
 insert into public.message_flags(user_id,message_id) values(auth.uid(),p_id) on conflict do nothing;
 update public.message_flags set hidden=case when p_kind='hidden' then p_value else hidden end,starred=case when p_kind='starred' then p_value else starred end where user_id=auth.uid() and message_id=p_id;
end $$;

create or replace function public.edit_message(p_id uuid,p_body text,p_expected timestamptz) returns public.messages language plpgsql security definer set search_path='' as $$
declare m public.messages;
begin
 select * into m from public.messages where id=p_id for update;
 perform public.assert_room_write(m.room_id);
 if not public.can_read_chat_sequence(m.room_id,m.sequence) or m.sender_id<>auth.uid() or m.deleted_at is not null or m.attachment_id is not null or m.post_id is not null then raise exception '수정할 수 없는 메시지입니다.';end if;
 if m.created_at<now()-interval '24 hours' and not exists(select 1 from public.chat_rooms where id=m.room_id and self_owner=auth.uid()) then raise exception '24시간이 지난 메시지는 수정할 수 없습니다.';end if;
 if m.updated_at is distinct from p_expected then raise exception '다른 기기에서 변경되었습니다. 다시 열어 주세요.';end if;
 if p_body is null or char_length(trim(p_body)) not between 1 and 4000 then raise exception '메시지는 1~4000자로 입력해 주세요.';end if;
 update public.messages set body=trim(p_body),edited_at=now() where id=p_id returning * into m;return m;
end $$;

create or replace function public.delete_message(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.messages;
begin
 select * into m from public.messages where id=p_id for update;
 if auth.uid() is null or m.id is null or m.sender_id<>auth.uid() or not public.can_read_chat_sequence(m.room_id,m.sequence) then raise exception 'Message access denied';end if;
 if m.deleted_at is not null then return;end if;
 if m.created_at<now()-interval '24 hours' and not exists(select 1 from public.chat_rooms where id=m.room_id and self_owner=auth.uid()) then raise exception '24시간이 지난 메시지는 모두에게서 삭제할 수 없습니다.';end if;
 update public.messages set body='삭제된 메시지입니다.',deleted_at=now(),attachment_id=null,reply_to=null where id=p_id;
 update public.push_jobs set status='skipped' where message_id=p_id and status='pending';
end $$;

create or replace function public.forward_message(p_id uuid,p_room uuid,p_key uuid) returns public.messages language plpgsql security definer set search_path='' as $$
declare m public.messages;saved public.messages;a public.chat_attachments;
begin
 perform public.assert_room_write(p_room);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into saved from public.messages where sender_id=auth.uid() and idempotency_key=p_key;
 if found then if saved.room_id<>p_room or not saved.forwarded or saved.forwarded_from is distinct from p_id then raise exception 'Idempotency conflict';end if;if not public.can_read_chat_sequence(saved.room_id,saved.sequence) then raise exception 'Message access denied';end if;return saved;end if;
 select * into m from public.messages where id=p_id for share;
 if m.id is null or m.deleted_at is not null or not public.can_read_chat_sequence(m.room_id,m.sequence) then raise exception '전달할 메시지에 접근할 수 없습니다.';end if;
 if m.attachment_id is not null then
 select * into a from public.chat_attachments where id=m.attachment_id;
 if a.original_deleted_at is not null or a.expires_at<=now() then raise exception '만료된 파일은 전달할 수 없습니다.';end if;
 end if;
 saved:=public.send_message(p_room,m.body,p_key);
 update public.messages set attachment_id=m.attachment_id,forwarded=true,forwarded_from=p_id where id=saved.id returning * into saved;return saved;
end $$;

create or replace function public.save_room_post(p_id uuid,p_room uuid,p_title text,p_body text,p_attachments uuid[],p_notice boolean,p_expected timestamptz default null) returns public.room_posts language plpgsql security definer set search_path='' as $$
declare post public.room_posts;item uuid;fresh boolean;event public.messages;
begin
 perform public.assert_room_write(p_room);
 perform pg_advisory_xact_lock(hashtextextended('post:'||p_id::text,0));
 if p_id is null or p_title is null or char_length(trim(p_title)) not between 1 and 120 or p_body is null or char_length(p_body)>20000 or p_notice is null or p_attachments is null or cardinality(p_attachments)>10 then raise exception '제목·본문·첨부를 확인해 주세요.';end if;
 select * into post from public.room_posts where id=p_id for update;fresh:=not found;
 if not fresh then
 if not public.can_read_room_post(post.id) or post.author_id<>auth.uid() or post.room_id<>p_room or post.deleted_at is not null then raise exception '게시글은 작성자만 변경할 수 있습니다.';end if;
 if p_expected is null and post.title=trim(p_title) and post.body=p_body and post.attachments=p_attachments and post.notice=p_notice then return post;end if;
 if post.updated_at is distinct from p_expected then raise exception '게시글이 변경되었습니다. 다시 열어 주세요.';end if;
 end if;
 foreach item in array p_attachments loop
 if not (item=any(coalesce(post.attachments,'{}'::uuid[]))) and not exists(select 1 from public.chat_attachments a where a.id=item and public.can_read_attachment(a.id) and a.original_deleted_at is null and (a.expires_at is null or a.expires_at>now()) and exists(select 1 from public.messages m where m.attachment_id=a.id and m.deleted_at is null and public.can_read_chat_sequence(m.room_id,m.sequence))) then raise exception '첨부 파일이 만료되었거나 접근할 수 없습니다.';end if;
 end loop;
 insert into public.room_posts(id,room_id,author_id,title,body,attachments,notice) values(p_id,p_room,auth.uid(),trim(p_title),p_body,p_attachments,p_notice)
 on conflict(id) do update set title=excluded.title,body=excluded.body,attachments=excluded.attachments,notice=excluded.notice,updated_at=clock_timestamp() returning * into post;
 if fresh or (p_notice and not exists(select 1 from public.messages where post_id=p_id and body like '[공지]%')) then
 event:=public.send_message(p_room,case when p_notice then '[공지] ' else '[게시글] ' end||trim(p_title),gen_random_uuid());
 update public.messages set post_id=p_id where id=event.id;
 end if;
 return post;
end $$;

create or replace function public.delete_room_post(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 update public.room_posts set deleted_at=now(),title='삭제된 게시글',body='',attachments='{}',notice=false,updated_at=clock_timestamp() where id=p_id and author_id=auth.uid() and public.can_read_room_post(id);
 if not found then raise exception '게시글은 작성자만 삭제할 수 있습니다.';end if;
 update public.messages set body='삭제된 게시글',updated_at=clock_timestamp() where post_id=p_id;
end $$;

create or replace function public.get_room_files(p_room uuid) returns setof public.chat_attachments language sql stable security definer set search_path='' as $$
 select a.* from public.chat_attachments a where public.is_room_member(p_room) and (exists(select 1 from public.messages m where m.room_id=p_room and public.can_read_chat_sequence(m.room_id,m.sequence) and m.attachment_id=a.id and m.deleted_at is null and not exists(select 1 from public.message_flags f where f.user_id=auth.uid() and f.message_id=m.id and f.hidden)) or exists(select 1 from public.room_posts p where p.room_id=p_room and public.can_read_room_post(p.id) and a.id=any(p.attachments) and p.deleted_at is null)) order by a.created_at desc;
$$;

create or replace function public.search_messages(p_room uuid,p_query text,p_before bigint default null) returns setof public.messages language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_room_member(p_room) then raise exception 'Room access denied';end if;
 if p_query is null or char_length(trim(p_query)) not between 1 and 100 then raise exception '검색어는 1~100자로 입력해 주세요.';end if;
 return query select m.* from public.messages m where m.room_id=p_room and public.can_read_chat_sequence(m.room_id,m.sequence) and m.deleted_at is null and not exists(select 1 from public.message_flags f where f.user_id=auth.uid() and f.message_id=m.id and f.hidden) and (p_before is null or m.sequence<p_before) and strpos(lower(m.body),lower(trim(p_query)))>0 order by m.sequence desc limit 50;
end $$;

create or replace function public.get_conversations() returns table(id uuid,direct_key text,peer jsonb,last_body text,last_at timestamptz,muted boolean)
language sql stable security definer set search_path='' as $$
 select r.id,r.direct_key,case when r.group_name is not null then jsonb_build_object('id',r.id,'username','','display_name',r.group_name,'history_start_sequence',mine.visible_after_sequence,'member_count',(select count(*) from public.chat_members where room_id=r.id)) when r.self_owner=auth.uid() then jsonb_build_object('id',r.self_owner,'username','','display_name','나와의 대화') else jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name) end,
 case when last.attachment_id is not null then '📎 '||left(last.body,160) else left(last.body,160) end,last.created_at,coalesce(pref.muted,false)
 from public.chat_rooms r join public.chat_members mine on mine.room_id=r.id and mine.user_id=auth.uid()
 left join lateral (select p.* from public.chat_members other join public.profiles p on p.id=other.user_id where other.room_id=r.id and other.user_id<>auth.uid() and r.group_name is null limit 1) p on true
 left join public.room_preferences pref on pref.room_id=r.id and pref.user_id=auth.uid()
 left join lateral (select m.body,m.created_at,m.attachment_id from public.messages m where m.room_id=r.id and public.can_read_chat_sequence(m.room_id,m.sequence) and not exists(select 1 from public.message_flags f where f.message_id=m.id and f.user_id=auth.uid() and f.hidden) order by m.sequence desc limit 1) last on true
 order by coalesce(last.created_at,r.created_at) desc,r.id;
$$;

create or replace function public.get_group_state(p_room uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_room_member(p_room) then raise exception '그룹 접근 권한이 없습니다.';end if;
 return jsonb_build_object('members',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,'joined_sequence',m.joined_sequence,'read_sequence',coalesce(r.last_read_sequence,0)) order by p.display_name),'[]') from public.chat_members m join public.profiles p on p.id=m.user_id left join public.chat_reads r on r.room_id=m.room_id and r.user_id=m.user_id where m.room_id=p_room),
 'authors',(select coalesce(jsonb_object_agg(p.id,p.display_name),'{}') from public.profiles p where exists(select 1 from public.messages m where m.room_id=p_room and m.sender_id=p.id and public.can_read_chat_sequence(m.room_id,m.sequence))));
end $$;

create or replace function public.get_expiring_files() returns table(id uuid,room_id uuid,name text,expires_at timestamptz) language sql stable security definer set search_path='' as $$
 select a.id,a.room_id,a.name,a.expires_at from public.chat_attachments a where public.is_room_member(a.room_id) and a.expires_at>now() and a.expires_at<=now()+interval '7 days' and exists(select 1 from public.messages m where m.attachment_id=a.id and m.deleted_at is null and public.can_read_chat_sequence(m.room_id,m.sequence)) order by a.expires_at limit 100;
$$;

create or replace function public.send_message(p_room uuid,p_body text,p_key uuid) returns public.messages
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); saved public.messages; next_seq bigint; peer uuid;
begin
 if actor is null or not public.is_room_member(p_room) then
  raise exception 'Room access denied' using errcode='42501';
 end if;
 if p_key is null or p_body is null or char_length(trim(p_body)) not between 1 and 4000 then
  raise exception 'Invalid message';
 end if;
 -- Serialize writes for each sender and room, so retry and quota checks are atomic.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select user_id into peer from public.chat_members where room_id=p_room and user_id<>actor;
 perform public.social_pair_lock(actor,peer);
 if public.social_blocked(actor,peer) then raise exception '차단 상태에서는 새 메시지를 주고받을 수 없습니다.' using errcode='42501'; end if;
 perform 1 from public.chat_rooms where id=p_room for update;
 select * into saved from public.messages where sender_id=actor and idempotency_key=p_key;
 if found then
  if saved.room_id<>p_room or saved.body<>trim(p_body) then raise exception 'Idempotency conflict'; end if;
  if not public.can_read_chat_sequence(saved.room_id,saved.sequence) then raise exception 'Message access denied';end if;return saved;
 end if;
 if (select count(*) from public.messages where sender_id=actor and created_at>now()-interval '1 minute')>=60 then
  raise exception 'Message rate limit';
 end if;
 update public.chat_rooms set last_sequence=last_sequence+1 where id=p_room returning last_sequence into next_seq;
 insert into public.messages(room_id,sender_id,body,idempotency_key,sequence)
 values(p_room,actor,trim(p_body),p_key,next_seq) returning * into saved;
 if not public.can_read_chat_sequence(saved.room_id,saved.sequence) then raise exception 'Message access denied';end if;return saved;
end $$;

create or replace function public.send_r2_attachment(p_id uuid,p_key text,p_receipt text) returns public.messages
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();a public.chat_attachments;saved public.messages;peer uuid;next_seq bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select * into a from public.chat_attachments where id=p_id;
 if actor is null or a.id is null or a.sender_id<>actor or not public.is_room_member(a.room_id) then raise exception 'Attachment access denied' using errcode='42501'; end if;
 select * into saved from public.messages where sender_id=actor and idempotency_key=p_id;
 if found then if saved.attachment_id is distinct from p_id then raise exception 'Idempotency conflict';end if;if not public.can_read_chat_sequence(saved.room_id,saved.sequence) then raise exception 'Message access denied';end if;return saved;end if;
 if p_key is null or p_key !~ ('^files/'||p_id::text||'/[a-f0-9-]{36}/manifest.json$') or p_receipt is null or p_receipt<>public.r2_receipt_mac(p_id::text||':'||a.size::text||':'||p_key) then raise exception 'Invalid upload receipt';end if;
 select user_id into peer from public.chat_members where room_id=a.room_id and user_id<>actor;
 perform public.social_pair_lock(actor,peer);
 if public.social_blocked(actor,peer) then raise exception '차단 상태에서는 파일을 보낼 수 없습니다.' using errcode='42501';end if;
 if (select count(*) from public.messages where sender_id=actor and created_at>now()-interval '1 minute')>=60 then raise exception 'Message rate limit';end if;
 update public.chat_attachments set r2_key=p_key,expires_at=now()+interval '30 days' where id=p_id;
 update public.chat_rooms set last_sequence=last_sequence+1 where id=a.room_id returning last_sequence into next_seq;
 insert into public.messages(room_id,sender_id,body,idempotency_key,sequence,attachment_id) values(a.room_id,actor,a.name,p_id,next_seq,p_id) returning * into saved;
 if not public.can_read_chat_sequence(saved.room_id,saved.sequence) then raise exception 'Message access denied';end if;return saved;
end $$;

create or replace function public.send_attachment(p_id uuid) returns public.messages
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
  if not public.can_read_chat_sequence(saved.room_id,saved.sequence) then raise exception 'Message access denied';end if;return saved;
 end if;
 if public.social_blocked(actor,peer) then raise exception '차단 상태에서는 파일을 보낼 수 없습니다.' using errcode='42501'; end if;
 select o.metadata into metadata from storage.objects o where o.bucket_id='chat-files' and o.name=a.path;
 if metadata is null or (metadata->>'size')::bigint is distinct from a.size or (metadata->>'mimetype') is distinct from a.mime then raise exception '파일 업로드를 완료한 후 다시 전송해 주세요.'; end if;
 if (select count(*) from public.messages where sender_id=actor and created_at>now()-interval '1 minute')>=60 then raise exception 'Message rate limit'; end if;
 update public.chat_rooms set last_sequence=last_sequence+1 where id=a.room_id returning last_sequence into next_seq;
 insert into public.messages(room_id,sender_id,body,idempotency_key,sequence,attachment_id) values(a.room_id,actor,a.name,p_id,next_seq,p_id) returning * into saved;
 if not public.can_read_chat_sequence(saved.room_id,saved.sequence) then raise exception 'Message access denied';end if;return saved;
end $$;

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
  if not public.can_read_attachment(a.id) then raise exception 'Attachment access denied';end if;return a;
 end if;
 if (select count(*) from public.chat_attachments where sender_id=actor and created_at>now()-interval '1 hour')>=20 then raise exception '파일은 1시간에 20개까지 보낼 수 있습니다.'; end if;
 insert into public.chat_attachments(id,room_id,sender_id,name,size,mime,path) values(p_id,p_room,actor,p_name,p_size,p_mime,actor::text||'/'||p_id::text) returning * into a;
 return a;
end $$;

commit;
