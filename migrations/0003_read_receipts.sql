begin;
create table public.chat_reads (
 room_id uuid not null,
 user_id uuid not null,
 last_read_sequence bigint not null default 0 check(last_read_sequence>=0),
 updated_at timestamptz not null default now(),
 primary key(room_id,user_id),
 foreign key(room_id,user_id) references public.chat_members(room_id,user_id)
);
alter table public.chat_reads enable row level security;
create policy chat_reads_select on public.chat_reads for select to authenticated using(public.is_room_member(room_id));
revoke all on public.chat_reads from anon,authenticated;
grant select on public.chat_reads to authenticated;
create function public.mark_chat_read(p_room uuid,p_sequence bigint) returns bigint
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); saved bigint; maximum bigint;
begin
 if actor is null or not public.is_room_member(p_room) then raise exception 'Room access denied' using errcode='42501'; end if;
 select last_sequence into maximum from public.chat_rooms where id=p_room;
 if p_sequence is null or p_sequence<0 or p_sequence>maximum then raise exception 'Invalid read position'; end if;
 insert into public.chat_reads as r(room_id,user_id,last_read_sequence) values(p_room,actor,p_sequence)
 on conflict(room_id,user_id) do update set last_read_sequence=greatest(r.last_read_sequence,excluded.last_read_sequence),updated_at=now()
 where r.last_read_sequence<excluded.last_read_sequence;
 select last_read_sequence into saved from public.chat_reads where room_id=p_room and user_id=actor;
 return saved;
end $$;
create function public.get_chat_activity() returns table(room_id uuid,unread_count bigint,peer_read_sequence bigint)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return query
 select mine.room_id,
 (select count(*) from public.messages m where m.room_id=mine.room_id and m.sender_id<>actor and m.sequence>coalesce(own.last_read_sequence,0)),
 coalesce((select min(coalesce(r.last_read_sequence,0)) from public.chat_members peer left join public.chat_reads r on r.room_id=peer.room_id and r.user_id=peer.user_id where peer.room_id=mine.room_id and peer.user_id<>actor),0)
 from public.chat_members mine left join public.chat_reads own on own.room_id=mine.room_id and own.user_id=actor
 where mine.user_id=actor;
end $$;
revoke all on function public.mark_chat_read(uuid,bigint),public.get_chat_activity() from public,anon;
grant execute on function public.mark_chat_read(uuid,bigint),public.get_chat_activity() to authenticated;
alter publication supabase_realtime add table public.chat_reads;
commit;
