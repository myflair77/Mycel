begin;
alter table public.messages add column reply_to uuid references public.messages(id), add column forwarded boolean not null default false, add column forwarded_from uuid references public.messages(id), add column edited_at timestamptz, add column deleted_at timestamptz, add column updated_at timestamptz not null default now();
alter table public.messages drop constraint messages_attachment_id_key;
create index messages_attachment_lookup on public.messages(attachment_id) where attachment_id is not null;
create index messages_changed on public.messages(room_id,updated_at);
create table public.message_flags(user_id uuid references public.profiles(id),message_id uuid references public.messages(id),hidden boolean not null default false,starred boolean not null default false,primary key(user_id,message_id));
alter table public.message_flags enable row level security;
grant select on public.message_flags to authenticated;
create policy flags_read on public.message_flags for select to authenticated using(user_id=auth.uid());
create table public.message_compositions(user_id uuid references public.profiles(id),send_key uuid,room_id uuid references public.chat_rooms(id),reply_to uuid references public.messages(id),primary key(user_id,send_key));
alter table public.message_compositions enable row level security;
create table public.room_posts(id uuid primary key,room_id uuid not null references public.chat_rooms(id),author_id uuid not null references public.profiles(id),title text not null check(char_length(title) between 1 and 120),body text not null check(char_length(body)<=20000),attachments uuid[] not null default '{}',notice boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz);
alter table public.room_posts enable row level security;
grant select on public.room_posts to authenticated;
create policy posts_read on public.room_posts for select to authenticated using(public.is_room_member(room_id));
alter table public.messages add column post_id uuid references public.room_posts(id);
revoke all on public.message_flags,public.message_compositions,public.room_posts from public,anon;
revoke insert,update,delete on public.message_flags,public.message_compositions,public.room_posts from authenticated;
create function public.assert_room_write(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_room_member(p_room) then raise exception 'Room access denied' using errcode='42501';end if;
 if exists(select 1 from public.chat_members where room_id=p_room and user_id<>auth.uid() and public.social_blocked(auth.uid(),user_id)) then raise exception '차단 상태에서는 전송하거나 게시할 수 없습니다.';end if;
end $$;
create function public.prepare_message_reply(p_key uuid,p_room uuid,p_reply uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_room_write(p_room);
 if exists(select 1 from public.message_compositions where user_id=auth.uid() and send_key=p_key and room_id=p_room and reply_to is not distinct from p_reply) then return;end if;
 if p_reply is not null and not exists(select 1 from public.messages where id=p_reply and room_id=p_room and deleted_at is null) then raise exception '답장할 원문이 없거나 삭제되었습니다.';end if;
 insert into public.message_compositions values(auth.uid(),p_key,p_room,p_reply) on conflict(user_id,send_key) do nothing;
 if not exists(select 1 from public.message_compositions where user_id=auth.uid() and send_key=p_key and room_id=p_room and reply_to is not distinct from p_reply) then raise exception 'Idempotency conflict';end if;
end $$;
create function public.message_composition_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then select c.reply_to into new.reply_to from public.message_compositions c where c.user_id=new.sender_id and c.send_key=new.idempotency_key and c.room_id=new.room_id;end if;
 new.updated_at=clock_timestamp();return new;
end $$;
create trigger apply_message_composition before insert or update on public.messages for each row execute function public.message_composition_trigger();
create function public.set_message_flag(p_id uuid,p_kind text,p_value boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.messages where id=p_id and public.is_room_member(room_id)) or auth.uid() is null then raise exception 'Message access denied';end if;
 if p_kind not in ('hidden','starred') or p_value is null then raise exception 'Invalid flag';end if;
 insert into public.message_flags(user_id,message_id) values(auth.uid(),p_id) on conflict do nothing;
 update public.message_flags set hidden=case when p_kind='hidden' then p_value else hidden end,starred=case when p_kind='starred' then p_value else starred end where user_id=auth.uid() and message_id=p_id;
end $$;
create function public.edit_message(p_id uuid,p_body text,p_expected timestamptz) returns public.messages language plpgsql security definer set search_path='' as $$
declare m public.messages;
begin
 select * into m from public.messages where id=p_id for update;
 perform public.assert_room_write(m.room_id);
 if m.sender_id<>auth.uid() or m.deleted_at is not null or m.attachment_id is not null or m.post_id is not null then raise exception '수정할 수 없는 메시지입니다.';end if;
 if m.created_at<now()-interval '24 hours' and not exists(select 1 from public.chat_rooms where id=m.room_id and self_owner=auth.uid()) then raise exception '24시간이 지난 메시지는 수정할 수 없습니다.';end if;
 if m.updated_at is distinct from p_expected then raise exception '다른 기기에서 변경되었습니다. 다시 열어 주세요.';end if;
 if p_body is null or char_length(trim(p_body)) not between 1 and 4000 then raise exception '메시지는 1~4000자로 입력해 주세요.';end if;
 update public.messages set body=trim(p_body),edited_at=now() where id=p_id returning * into m;return m;
end $$;
create function public.delete_message(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.messages;
begin
 select * into m from public.messages where id=p_id for update;
 if auth.uid() is null or m.id is null or m.sender_id<>auth.uid() or not public.is_room_member(m.room_id) then raise exception 'Message access denied';end if;
 if m.deleted_at is not null then return;end if;
 if m.created_at<now()-interval '24 hours' and not exists(select 1 from public.chat_rooms where id=m.room_id and self_owner=auth.uid()) then raise exception '24시간이 지난 메시지는 모두에게서 삭제할 수 없습니다.';end if;
 update public.messages set body='삭제된 메시지입니다.',deleted_at=now(),attachment_id=null,reply_to=null where id=p_id;
 update public.push_jobs set status='skipped' where message_id=p_id and status='pending';
end $$;
create function public.can_read_attachment(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.chat_attachments a where a.id=p_id and (a.sender_id=auth.uid() or exists(select 1 from public.messages m where m.attachment_id=a.id and m.deleted_at is null and public.is_room_member(m.room_id)) or exists(select 1 from public.room_posts p where a.id=any(p.attachments) and p.deleted_at is null and public.is_room_member(p.room_id))));
$$;
drop policy attachment_metadata_read on public.chat_attachments;
create policy attachment_metadata_read on public.chat_attachments for select to authenticated using(public.can_read_attachment(id));
create or replace function public.can_use_chat_file(p_path text,p_write boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chat_attachments a where a.path=p_path and case when p_write then public.is_room_member(a.room_id) and a.sender_id=auth.uid() and not exists(select 1 from public.messages m where m.attachment_id=a.id) and not exists(select 1 from public.chat_members cm where cm.room_id=a.room_id and cm.user_id<>auth.uid() and public.social_blocked(auth.uid(),cm.user_id)) else public.can_read_attachment(a.id) and (a.expires_at is null or a.expires_at>now()) and a.original_deleted_at is null end);
$$;
create function public.forward_message(p_id uuid,p_room uuid,p_key uuid) returns public.messages language plpgsql security definer set search_path='' as $$
declare m public.messages;saved public.messages;a public.chat_attachments;
begin
 perform public.assert_room_write(p_room);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into saved from public.messages where sender_id=auth.uid() and idempotency_key=p_key;
 if found then if saved.room_id<>p_room or not saved.forwarded or saved.forwarded_from is distinct from p_id then raise exception 'Idempotency conflict';end if;return saved;end if;
 select * into m from public.messages where id=p_id for share;
 if m.id is null or m.deleted_at is not null or not public.is_room_member(m.room_id) then raise exception '전달할 메시지에 접근할 수 없습니다.';end if;
 if m.attachment_id is not null then
 select * into a from public.chat_attachments where id=m.attachment_id;
 if a.original_deleted_at is not null or a.expires_at<=now() then raise exception '만료된 파일은 전달할 수 없습니다.';end if;
 end if;
 saved:=public.send_message(p_room,m.body,p_key);
 update public.messages set attachment_id=m.attachment_id,forwarded=true,forwarded_from=p_id where id=saved.id returning * into saved;return saved;
end $$;
create function public.save_room_post(p_id uuid,p_room uuid,p_title text,p_body text,p_attachments uuid[],p_notice boolean,p_expected timestamptz default null) returns public.room_posts language plpgsql security definer set search_path='' as $$
declare post public.room_posts;item uuid;fresh boolean;event public.messages;
begin
 perform public.assert_room_write(p_room);
 perform pg_advisory_xact_lock(hashtextextended('post:'||p_id::text,0));
 if p_id is null or p_title is null or char_length(trim(p_title)) not between 1 and 120 or p_body is null or char_length(p_body)>20000 or p_notice is null or p_attachments is null or cardinality(p_attachments)>10 then raise exception '제목·본문·첨부를 확인해 주세요.';end if;
 select * into post from public.room_posts where id=p_id for update;fresh:=not found;
 if not fresh then
 if post.author_id<>auth.uid() or post.room_id<>p_room or post.deleted_at is not null then raise exception '게시글은 작성자만 변경할 수 있습니다.';end if;
 if p_expected is null and post.title=trim(p_title) and post.body=p_body and post.attachments=p_attachments and post.notice=p_notice then return post;end if;
 if post.updated_at is distinct from p_expected then raise exception '게시글이 변경되었습니다. 다시 열어 주세요.';end if;
 end if;
 foreach item in array p_attachments loop
 if not (item=any(coalesce(post.attachments,'{}'::uuid[]))) and not exists(select 1 from public.chat_attachments a where a.id=item and public.can_read_attachment(a.id) and a.original_deleted_at is null and (a.expires_at is null or a.expires_at>now()) and exists(select 1 from public.messages m where m.attachment_id=a.id and m.deleted_at is null and public.is_room_member(m.room_id))) then raise exception '첨부 파일이 만료되었거나 접근할 수 없습니다.';end if;
 end loop;
 insert into public.room_posts(id,room_id,author_id,title,body,attachments,notice) values(p_id,p_room,auth.uid(),trim(p_title),p_body,p_attachments,p_notice)
 on conflict(id) do update set title=excluded.title,body=excluded.body,attachments=excluded.attachments,notice=excluded.notice,updated_at=clock_timestamp() returning * into post;
 if fresh or (p_notice and not exists(select 1 from public.messages where post_id=p_id and body like '[공지]%')) then
 event:=public.send_message(p_room,case when p_notice then '[공지] ' else '[게시글] ' end||trim(p_title),gen_random_uuid());
 update public.messages set post_id=p_id where id=event.id;
 end if;
 return post;
end $$;
create function public.delete_room_post(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 update public.room_posts set deleted_at=now(),title='삭제된 게시글',body='',attachments='{}',notice=false,updated_at=clock_timestamp() where id=p_id and author_id=auth.uid() and public.is_room_member(room_id);
 if not found then raise exception '게시글은 작성자만 삭제할 수 있습니다.';end if;
 update public.messages set body='삭제된 게시글',updated_at=clock_timestamp() where post_id=p_id;
end $$;
create function public.get_room_files(p_room uuid) returns setof public.chat_attachments language sql stable security definer set search_path='' as $$
 select a.* from public.chat_attachments a where public.is_room_member(p_room) and (exists(select 1 from public.messages m where m.room_id=p_room and m.attachment_id=a.id and m.deleted_at is null and not exists(select 1 from public.message_flags f where f.user_id=auth.uid() and f.message_id=m.id and f.hidden)) or exists(select 1 from public.room_posts p where p.room_id=p_room and a.id=any(p.attachments) and p.deleted_at is null)) order by a.created_at desc;
$$;
create or replace function public.search_messages(p_room uuid,p_query text,p_before bigint default null) returns setof public.messages language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_room_member(p_room) then raise exception 'Room access denied';end if;
 if p_query is null or char_length(trim(p_query)) not between 1 and 100 then raise exception '검색어는 1~100자로 입력해 주세요.';end if;
 return query select m.* from public.messages m where m.room_id=p_room and m.deleted_at is null and not exists(select 1 from public.message_flags f where f.user_id=auth.uid() and f.message_id=m.id and f.hidden) and (p_before is null or m.sequence<p_before) and strpos(lower(m.body),lower(trim(p_query)))>0 order by m.sequence desc limit 50;
end $$;
revoke all on function public.assert_room_write(uuid),public.message_composition_trigger() from public,anon,authenticated;
revoke all on function public.prepare_message_reply(uuid,uuid,uuid),public.set_message_flag(uuid,text,boolean),public.edit_message(uuid,text,timestamptz),public.delete_message(uuid),public.can_read_attachment(uuid),public.forward_message(uuid,uuid,uuid),public.save_room_post(uuid,uuid,text,text,uuid[],boolean,timestamptz),public.delete_room_post(uuid),public.get_room_files(uuid) from public,anon;
grant execute on function public.prepare_message_reply(uuid,uuid,uuid),public.set_message_flag(uuid,text,boolean),public.edit_message(uuid,text,timestamptz),public.delete_message(uuid),public.can_read_attachment(uuid),public.forward_message(uuid,uuid,uuid),public.save_room_post(uuid,uuid,text,text,uuid[],boolean,timestamptz),public.delete_room_post(uuid),public.get_room_files(uuid) to authenticated;
create or replace function public.get_conversations() returns table(id uuid,direct_key text,peer jsonb,last_body text,last_at timestamptz,muted boolean)
language sql stable security definer set search_path='' as $$
 select r.id,r.direct_key,case when r.self_owner=auth.uid() then jsonb_build_object('id',r.self_owner,'username','','display_name','나와의 대화') else jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name) end,
 case when last.attachment_id is not null then '📎 '||left(last.body,160) else left(last.body,160) end,
 last.created_at,coalesce(pref.muted,false)
 from public.chat_rooms r join public.chat_members mine on mine.room_id=r.id and mine.user_id=auth.uid()
 left join public.chat_members other on other.room_id=r.id and other.user_id<>auth.uid()
 left join public.profiles p on p.id=other.user_id
 left join public.room_preferences pref on pref.room_id=r.id and pref.user_id=auth.uid()
 left join lateral (select m.body,m.created_at,m.attachment_id from public.messages m where m.room_id=r.id and not exists(select 1 from public.message_flags f where f.message_id=m.id and f.user_id=auth.uid() and f.hidden) order by m.sequence desc limit 1) last on true
 order by coalesce(last.created_at,r.created_at) desc,r.id;
$$;
create or replace function public.get_chat_activity() returns table(room_id uuid,unread_count bigint,peer_read_sequence bigint)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return query
 select mine.room_id,
 (select count(*) from public.messages m where m.room_id=mine.room_id and m.sender_id<>actor and m.deleted_at is null and not exists(select 1 from public.message_flags f where f.message_id=m.id and f.user_id=actor and f.hidden) and m.sequence>coalesce(own.last_read_sequence,0)),
 coalesce((select min(coalesce(r.last_read_sequence,0)) from public.chat_members peer left join public.chat_reads r on r.room_id=peer.room_id and r.user_id=peer.user_id where peer.room_id=mine.room_id and peer.user_id<>actor),0)
 from public.chat_members mine left join public.chat_reads own on own.room_id=mine.room_id and own.user_id=actor
 where mine.user_id=actor;
end $$;
create or replace function public.push_badge_snapshot(p_user uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('userId',p_user,'unreadCount',count(*),'badgeAt',floor(extract(epoch from statement_timestamp())*1000000))
 from public.messages m join public.chat_members member on member.room_id=m.room_id and member.user_id=p_user
 left join public.chat_reads r on r.room_id=m.room_id and r.user_id=p_user
 where m.sender_id<>p_user and m.deleted_at is null and not exists(select 1 from public.message_flags f where f.message_id=m.id and f.user_id=p_user and f.hidden) and m.sequence>coalesce(r.last_read_sequence,0)
$$;
commit;
