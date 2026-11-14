begin;
create function public.push_badge_snapshot(p_user uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('userId',p_user,'unreadCount',count(*),'badgeAt',floor(extract(epoch from statement_timestamp())*1000000))
 from public.messages m join public.chat_members member on member.room_id=m.room_id and member.user_id=p_user
 left join public.chat_reads r on r.room_id=m.room_id and r.user_id=p_user
 where m.sender_id<>p_user and m.sequence>coalesce(r.last_read_sequence,0)
$$;
revoke all on function public.push_badge_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.push_badge_snapshot(uuid) to service_role;
create function public.get_badge_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return public.push_badge_snapshot(auth.uid());
end $$;
revoke all on function public.get_badge_snapshot() from public,anon;
grant execute on function public.get_badge_snapshot() to authenticated;
commit;
