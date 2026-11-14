begin;
create table public.r2_receipt_secret(id boolean primary key default true check(id),key_hex text not null check(key_hex ~ '^[a-f0-9]{64}$'));
alter table public.r2_receipt_secret enable row level security;
revoke all on public.r2_receipt_secret from public,anon,authenticated;
alter table public.chat_attachments add column r2_key text;
alter table public.chat_attachments add column expires_at timestamptz;
alter table public.chat_attachments add column original_deleted_at timestamptz;
create function public.r2_receipt_mac(payload text) returns text language plpgsql security definer set search_path='' as $$
declare k bytea; ipad bytea:=decode(repeat('36',64),'hex'); opad bytea:=decode(repeat('5c',64),'hex');i integer;
begin
 select decode(key_hex,'hex') into k from public.r2_receipt_secret where id=true;
 if k is null then raise exception 'File service not configured'; end if;
 for i in 0..31 loop ipad:=set_byte(ipad,i,get_byte(ipad,i)#get_byte(k,i));opad:=set_byte(opad,i,get_byte(opad,i)#get_byte(k,i));end loop;
 return encode(sha256(opad||sha256(ipad||convert_to(payload,'UTF8'))),'hex');
end $$;
revoke all on function public.r2_receipt_mac(text) from public,anon,authenticated;
create function public.send_r2_attachment(p_id uuid,p_key text,p_receipt text) returns public.messages
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();a public.chat_attachments;saved public.messages;peer uuid;next_seq bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select * into a from public.chat_attachments where id=p_id;
 if actor is null or a.id is null or a.sender_id<>actor or not public.is_room_member(a.room_id) then raise exception 'Attachment access denied' using errcode='42501'; end if;
 select * into saved from public.messages where sender_id=actor and idempotency_key=p_id;
 if found then if saved.attachment_id is distinct from p_id then raise exception 'Idempotency conflict';end if;return saved;end if;
 if p_key is null or p_key !~ ('^files/'||p_id::text||'/[a-f0-9-]{36}/manifest.json$') or p_receipt is null or p_receipt<>public.r2_receipt_mac(p_id::text||':'||a.size::text||':'||p_key) then raise exception 'Invalid upload receipt';end if;
 select user_id into peer from public.chat_members where room_id=a.room_id and user_id<>actor;
 perform public.social_pair_lock(actor,peer);
 if public.social_blocked(actor,peer) then raise exception '차단 상태에서는 파일을 보낼 수 없습니다.' using errcode='42501';end if;
 if (select count(*) from public.messages where sender_id=actor and created_at>now()-interval '1 minute')>=60 then raise exception 'Message rate limit';end if;
 update public.chat_attachments set r2_key=p_key,expires_at=now()+interval '30 days' where id=p_id;
 update public.chat_rooms set last_sequence=last_sequence+1 where id=a.room_id returning last_sequence into next_seq;
 insert into public.messages(room_id,sender_id,body,idempotency_key,sequence,attachment_id) values(a.room_id,actor,a.name,p_id,next_seq,p_id) returning * into saved;
 return saved;
end $$;
revoke all on function public.send_r2_attachment(uuid,text,text) from public,anon;
grant execute on function public.send_r2_attachment(uuid,text,text) to authenticated;
commit;
