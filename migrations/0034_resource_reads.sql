begin;
create or replace function public.workspace_list(p_kind text,p_room uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]') from (select i.*,(select display_name from public.profiles where id=i.owner_id) as creator_name,public.workspace_permission(i.id,p_room) as permission,(select coalesce(jsonb_agg(jsonb_build_object('room_id',s.room_id,'permission',s.permission)),'[]') from public.workspace_shares s where s.item_id=i.id and (i.owner_id=auth.uid() or public.can_read_chat_sequence(s.room_id,s.history_sequence))) as shares from public.workspace_items i where i.kind=p_kind and coalesce(public.workspace_permission(i.id,p_room),0)>0 and ((p_room is null and ((i.space_id is null and i.owner_id=auth.uid()) or exists(select 1 from public.workspace_library l where l.item_id=i.id and l.user_id=auth.uid()))) or i.space_id=p_room or exists(select 1 from public.workspace_shares s where s.item_id=i.id and s.room_id=p_room and public.can_read_chat_sequence(s.room_id,s.history_sequence))))x);
end $$;
-- Receipts only: existing items, content, permissions and history are untouched.
create table public.workspace_reads(
 user_id uuid not null references public.profiles(id),
 item_id uuid not null references public.workspace_items(id),
 scope_id uuid not null,
 version bigint not null check(version>=0),
 primary key(user_id,item_id,scope_id)
);
alter table public.workspace_reads enable row level security;
revoke all on public.workspace_reads from public,anon,authenticated;
create function public.workspace_unread(p_room uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'kind',i.kind,'version',i.version)),'[]')
 from jsonb_to_recordset(public.workspace_list('event',p_room)||public.workspace_list('note',p_room))
 as i(id uuid,kind text,version bigint,owner_id uuid,trashed boolean)
 left join public.workspace_reads r on r.item_id=i.id and r.user_id=auth.uid() and r.scope_id=coalesce(p_room,'00000000-0000-0000-0000-000000000000'::uuid)
 where not i.trashed and i.version>coalesce(r.version,0)
 and ((r.item_id is null and i.owner_id<>auth.uid()) or exists(
 select 1 from public.workspace_history h where h.item_id=i.id and h.revision>coalesce(r.version,0) and h.actor<>auth.uid())));
end $$;
create function public.workspace_mark_read(p_id uuid,p_version bigint,p_room uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare i public.workspace_items;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 select * into i from public.workspace_items where id=p_id;
 if i.id is null or coalesce(public.workspace_permission(p_id,p_room),0)=0 or not exists(
 select 1 from jsonb_array_elements(public.workspace_list(i.kind,p_room)) x where x->>'id'=p_id::text
 ) then raise exception '자료 접근 권한이 없습니다.';end if;
 if p_version is null or p_version<1 or p_version>i.version then raise exception '확인한 버전이 올바르지 않습니다.';end if;
 insert into public.workspace_reads values(auth.uid(),p_id,coalesce(p_room,'00000000-0000-0000-0000-000000000000'::uuid),p_version)
 on conflict(user_id,item_id,scope_id) do update set version=greatest(public.workspace_reads.version,excluded.version);
end $$;
revoke all on function public.workspace_unread(uuid),public.workspace_mark_read(uuid,bigint,uuid) from public,anon;
grant execute on function public.workspace_unread(uuid),public.workspace_mark_read(uuid,bigint,uuid) to authenticated;
commit;
