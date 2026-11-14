begin;
alter table public.chat_rooms add column self_owner uuid references public.profiles(id);
create unique index chat_rooms_self_owner_unique on public.chat_rooms(self_owner) where self_owner is not null;
create function public.open_self_chat() returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); room uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('self:'||actor::text,0));
 insert into public.chat_rooms(direct_key,self_owner) values('self:'||actor::text,actor) on conflict(direct_key) do nothing;
 select id into room from public.chat_rooms where self_owner=actor;
 insert into public.chat_members(room_id,user_id) values(room,actor) on conflict do nothing;
 return room;
end $$;
revoke all on function public.open_self_chat() from public,anon;
grant execute on function public.open_self_chat() to authenticated;
create function public.guard_self_member() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.chat_rooms where id=new.room_id and self_owner is not null and self_owner<>new.user_id) then raise exception 'Private room owner only' using errcode='42501'; end if;
 return new;
end $$;
create trigger guard_self_member before insert or update on public.chat_members for each row execute function public.guard_self_member();
revoke all on function public.guard_self_member() from public,anon,authenticated;
create or replace function public.get_conversations() returns table(id uuid,direct_key text,peer jsonb,last_body text,last_at timestamptz,muted boolean)
language sql stable security definer set search_path='' as $$
 select r.id,r.direct_key,case when r.self_owner=auth.uid() then jsonb_build_object('id',r.self_owner,'username','','display_name','나와의 대화') else jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name) end,
 case when last.attachment_id is not null then '📎 '||left(last.body,160) else left(last.body,160) end,
 last.created_at,coalesce(pref.muted,false)
 from public.chat_rooms r join public.chat_members mine on mine.room_id=r.id and mine.user_id=auth.uid()
 left join public.chat_members other on other.room_id=r.id and other.user_id<>auth.uid()
 left join public.profiles p on p.id=other.user_id
 left join public.room_preferences pref on pref.room_id=r.id and pref.user_id=auth.uid()
 left join lateral (select m.body,m.created_at,m.attachment_id from public.messages m where m.room_id=r.id order by m.sequence desc limit 1) last on true
 order by coalesce(last.created_at,r.created_at) desc,r.id;
$$;
commit;
