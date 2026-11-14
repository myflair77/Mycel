begin;
create function public.r2_cleanup_list(p_mac text) returns table(id uuid,r2_key text,size bigint) language plpgsql security definer set search_path='' as $$
begin
 if p_mac is null or p_mac<>public.r2_receipt_mac('retention-scan') then raise exception 'Access denied' using errcode='42501';end if;
 return query select a.id,a.r2_key,a.size from public.chat_attachments a where a.r2_key is not null and a.expires_at<=now() and a.original_deleted_at is null order by a.expires_at limit 50;
end $$;
create function public.r2_cleanup_done(p_id uuid,p_mac text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_mac is null or p_mac<>public.r2_receipt_mac('deleted:'||p_id::text) then raise exception 'Access denied' using errcode='42501';end if;
 update public.chat_attachments set original_deleted_at=now() where id=p_id and expires_at<=now() and r2_key is not null;
end $$;
create function public.get_expiring_files() returns table(id uuid,room_id uuid,name text,expires_at timestamptz) language sql stable security definer set search_path='' as $$
 select a.id,a.room_id,a.name,a.expires_at from public.chat_attachments a where public.is_room_member(a.room_id) and a.expires_at>now() and a.expires_at<=now()+interval '7 days' and exists(select 1 from public.messages m where m.attachment_id=a.id) order by a.expires_at limit 100;
$$;
revoke all on function public.r2_cleanup_list(text),public.r2_cleanup_done(uuid,text),public.get_expiring_files() from public,anon,authenticated;
grant execute on function public.r2_cleanup_list(text),public.r2_cleanup_done(uuid,text) to anon;
grant execute on function public.get_expiring_files() to authenticated;
commit;
