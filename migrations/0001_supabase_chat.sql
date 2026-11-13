-- Development beta: email auth + exact username lookup + direct chat.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id),
 username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
 display_name text not null check (char_length(display_name) between 1 and 40),
 created_at timestamptz not null default now()
);
create table public.chat_rooms (
 id uuid primary key default gen_random_uuid(),
 direct_key text not null unique,
 created_at timestamptz not null default now(),
 last_sequence bigint not null default 0
);
create table public.chat_members (
 room_id uuid not null references public.chat_rooms(id),
 user_id uuid not null references public.profiles(id),
 primary key(room_id,user_id)
);
create index chat_members_user_idx on public.chat_members(user_id,room_id);
create table public.messages (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.chat_rooms(id),
 sender_id uuid not null references public.profiles(id),
 body text not null check(char_length(body) between 1 and 4000),
 idempotency_key uuid not null,
 sequence bigint not null,
 created_at timestamptz not null default now(),
 unique(sender_id,idempotency_key),
 unique(room_id,sequence)
);
create index messages_sender_time_idx on public.messages(sender_id,created_at);
alter table public.profiles enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;

create function public.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,username,display_name)
 values(new.id,lower(trim(new.raw_user_meta_data->>'username')),trim(new.raw_user_meta_data->>'display_name'));
 return new;
end $$;
create trigger create_profile after insert on auth.users
for each row execute function public.on_auth_user_created();

create function public.is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.chat_members where room_id=p_room and user_id=(select auth.uid()));
$$;
create policy profiles_read on public.profiles for select to authenticated using (
 id=(select auth.uid()) or exists(select 1 from public.chat_members m where m.user_id=profiles.id and public.is_room_member(m.room_id))
);
create policy rooms_read on public.chat_rooms for select to authenticated using(public.is_room_member(id));
create policy members_read on public.chat_members for select to authenticated using(public.is_room_member(room_id));
create policy messages_read on public.messages for select to authenticated using(public.is_room_member(room_id));

create function public.open_direct_chat(p_username text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); peer uuid; pair text; room uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select id into peer from public.profiles where username=lower(trim(p_username));
 if peer is null or peer=actor then raise exception 'User not found or self'; end if;
 pair:=least(actor::text,peer::text)||':'||greatest(actor::text,peer::text);
 insert into public.chat_rooms(direct_key) values(pair) on conflict(direct_key) do nothing;
 select id into room from public.chat_rooms where direct_key=pair;
 insert into public.chat_members(room_id,user_id) values(room,actor),(room,peer) on conflict do nothing;
 return room;
end $$;

create function public.send_message(p_room uuid,p_body text,p_key uuid) returns public.messages
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); saved public.messages; next_seq bigint;
begin
 if actor is null or not public.is_room_member(p_room) then
  raise exception 'Room access denied' using errcode='42501';
 end if;
 if p_key is null or p_body is null or char_length(trim(p_body)) not between 1 and 4000 then
  raise exception 'Invalid message';
 end if;
 -- Serialize writes for each sender and room, so retry and quota checks are atomic.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 perform 1 from public.chat_rooms where id=p_room for update;
 select * into saved from public.messages where sender_id=actor and idempotency_key=p_key;
 if found then
  if saved.room_id<>p_room or saved.body<>trim(p_body) then raise exception 'Idempotency conflict'; end if;
  return saved;
 end if;
 if (select count(*) from public.messages where sender_id=actor and created_at>now()-interval '1 minute')>=60 then
  raise exception 'Message rate limit';
 end if;
 update public.chat_rooms set last_sequence=last_sequence+1 where id=p_room returning last_sequence into next_seq;
 insert into public.messages(room_id,sender_id,body,idempotency_key,sequence)
 values(p_room,actor,trim(p_body),p_key,next_seq) returning * into saved;
 return saved;
end $$;

revoke all on public.profiles,public.chat_rooms,public.chat_members,public.messages from anon,authenticated;
grant select on public.profiles,public.chat_rooms,public.chat_members,public.messages to authenticated;
revoke all on function public.on_auth_user_created() from public,anon,authenticated;
revoke all on function public.is_room_member(uuid),public.open_direct_chat(text),public.send_message(uuid,text,uuid) from public,anon;
grant execute on function public.is_room_member(uuid),public.open_direct_chat(text),public.send_message(uuid,text,uuid) to authenticated;
alter publication supabase_realtime add table public.messages;
commit;
