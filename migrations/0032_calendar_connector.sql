begin;

create table public.calendar_connections (
  owner_id uuid primary key references public.profiles(id),
  google_calendar text not null,
  direction text not null check(direction in ('import','export','both')),
  code_hash bytea, expires_at timestamptz,
  credential_hash bytea unique, linked_at timestamptz
);
create table public.calendar_sync_records (
  owner_id uuid not null references public.profiles(id),
  google_calendar text not null, google_id text not null,
  item_id uuid not null references public.workspace_items(id),
  mycel_version bigint not null, google_version text not null,
  recorded_at timestamptz not null default now(),
  primary key(owner_id,google_calendar,google_id),
  unique(owner_id,google_calendar,item_id)
);
create table public.calendar_sync_requests (
  owner_id uuid not null references public.profiles(id),
  request_id uuid not null, signature bytea not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key(owner_id,request_id)
);
alter table public.calendar_connections enable row level security;
alter table public.calendar_sync_records enable row level security;
alter table public.calendar_sync_requests enable row level security;
revoke all on public.calendar_connections, public.calendar_sync_records, public.calendar_sync_requests from public,anon,authenticated;

create table public.calendar_proposals (
 owner_id uuid not null references public.profiles(id), request_id uuid not null,
 signature bytea not null, tool text not null, args jsonb not null,
 approved boolean not null default false, expires_at timestamptz not null default now()+interval '24 hours',
 primary key(owner_id,request_id)
);
alter table public.calendar_proposals enable row level security;
revoke all on public.calendar_proposals from public,anon,authenticated;
create function public.calendar_connection_settings() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('linked',c.linked_at is not null,'calendar',c.google_calendar,'direction',c.direction,'pending',
 (select coalesce(jsonb_agg(jsonb_build_object('request_id',p.request_id,'tool',p.tool,'args',p.args) order by p.expires_at),'[]')
 from public.calendar_proposals p where p.owner_id=auth.uid() and not p.approved and p.expires_at>now()))
 from public.calendar_connections c where c.owner_id=auth.uid()
$$;
create function public.calendar_approve(p_request uuid) returns void language sql security definer set search_path='' as $$
 update public.calendar_proposals set approved=true where owner_id=auth.uid() and request_id=p_request and expires_at>now()
$$;
revoke all on function public.calendar_connection_settings(), public.calendar_approve(uuid) from public,anon;
grant execute on function public.calendar_connection_settings(), public.calendar_approve(uuid) to authenticated;

create function public.calendar_connect(p_calendar text,p_direction text) returns uuid
language plpgsql security definer set search_path='' as $$
declare code uuid := gen_random_uuid();
begin
 if auth.uid() is null or length(trim(p_calendar)) not between 1 and 1024 then raise exception '캘린더 ID를 확인하세요.'; end if;
 insert into public.calendar_connections(owner_id,google_calendar,direction,code_hash,expires_at)
 values(auth.uid(),trim(p_calendar),p_direction,sha256(convert_to(code::text,'UTF8')),now()+interval '5 minutes')
 on conflict(owner_id) do update set google_calendar=excluded.google_calendar,direction=excluded.direction,
 code_hash=excluded.code_hash,expires_at=excluded.expires_at,credential_hash=null,linked_at=null;
 delete from public.calendar_proposals where owner_id=auth.uid(); return code;
end $$;
create function public.calendar_disconnect() returns void language sql security definer set search_path='' as $$
 delete from public.calendar_proposals where owner_id=auth.uid(); delete from public.calendar_connections where owner_id=auth.uid()
$$;
create function public.calendar_pair(p_code uuid,p_secret text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_secret is null or p_secret !~ '^[a-f0-9]{64}$' then return false; end if;
 update public.calendar_connections set credential_hash=sha256(convert_to(p_secret,'UTF8')),code_hash=null,expires_at=null,linked_at=now()
 where code_hash=sha256(convert_to(p_code::text,'UTF8')) and expires_at>now();
 return found;
end $$;

create function public.calendar_connector(p_secret text,p_tool text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 conn public.calendar_connections; item public.workspace_items; mapping public.calendar_sync_records;
 previous public.calendar_sync_requests; result jsonb; request_hash bytea; req uuid;
 event_id uuid := (p_args->>'id')::uuid; patch jsonb; next_title text; fields jsonb; stamp timestamptz;
begin
 select * into strict conn from public.calendar_connections where credential_hash=sha256(convert_to(p_secret,'UTF8')) for update;
 if p_tool in ('calendar_list','calendar_get_sync_status') then
   return jsonb_build_object('google_calendar',conn.google_calendar,'direction',conn.direction,'linked_at',conn.linked_at,
     'scheduled_execution','unverified','mapped_events',(select count(*) from public.calendar_sync_records where owner_id=conn.owner_id and google_calendar=conn.google_calendar),
     'last_recorded_at',(select max(recorded_at) from public.calendar_sync_records where owner_id=conn.owner_id and google_calendar=conn.google_calendar));
 end if;
 if p_tool in ('calendar_get_events','calendar_get_changes') then
   if p_tool='calendar_get_events' and (p_args->>'from' is null or p_args->>'until' is null or (p_args->>'from')::date >= (p_args->>'until')::date) then raise exception '조회 기간을 확인하세요.'; end if;
   if p_tool='calendar_get_changes' then stamp:=coalesce((p_args->>'since')::timestamptz,'-infinity'); end if;
   return (select coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]') from (
     select i.id,i.title,i.version,i.updated_at,i.trashed,i.body->>'start' as start,i.body->>'end' as "end"
     from public.workspace_items i where i.owner_id=conn.owner_id and i.space_id is null and i.kind='event'
       and (p_args->>'after_id' is null or i.id>(p_args->>'after_id')::uuid)
       and ((p_tool='calendar_get_changes' and i.updated_at>=stamp) or
            (p_tool='calendar_get_events' and not i.trashed and left(i.body->>'start',10)<p_args->>'until' and left(i.body->>'end',10)>=p_args->>'from'))
     order by i.id limit 100) q);
 end if;
 select * into item from public.workspace_items where id=event_id and kind='event' and owner_id=conn.owner_id and space_id is null for update;
 select * into mapping from public.calendar_sync_records where owner_id=conn.owner_id and google_calendar=conn.google_calendar
   and (item_id=event_id or google_id=p_args->>'google_id');
 if p_tool='calendar_get_event' then
   if item.id is null and mapping.item_id is not null then
     select * into item from public.workspace_items where id=mapping.item_id and kind='event' and owner_id=conn.owner_id and space_id is null;
   end if;
   if item.id is null then return 'null'::jsonb; end if;
   select coalesce(jsonb_object_agg(key,value),'{}') into fields from jsonb_each(item.body)
    where key in ('start','end','all_day','location','description','cancelled','timezone','recurrence_rule','recurrence_instance_id');
   return jsonb_build_object('id',item.id,'title',item.title,'body',fields,'trashed',item.trashed,'version',item.version,'mapping',to_jsonb(mapping)-'owner_id');
 end if;
 req:=(p_args->>'request_id')::uuid;
 if req is null or event_id is null then raise exception '일정 ID와 요청 ID가 필요합니다.'; end if;
 request_hash:=sha256(convert_to(jsonb_build_array(conn.google_calendar,p_tool,p_args)::text,'UTF8'));
 select * into previous from public.calendar_sync_requests where owner_id=conn.owner_id and request_id=req;
 if found then
   if previous.signature<>request_hash then raise exception '요청 ID 충돌'; end if;
   return previous.result;
 end if;
 if mapping.item_id is not null and mapping.item_id<>event_id then raise exception 'Google 일정이 이미 연결되었습니다.'; end if;
 if p_tool='calendar_record_sync' then
   if item.id is null or item.version is distinct from (p_args->>'version')::bigint or nullif(p_args->>'google_id','') is null or nullif(p_args->>'google_version','') is null then raise exception '양쪽 버전을 다시 확인하세요.'; end if;
   if mapping.item_id is not null and (mapping.google_id<>p_args->>'google_id' or mapping.google_version is distinct from p_args->>'previous_google_version') then raise exception '연결 버전 충돌'; end if;
   insert into public.calendar_sync_records values(conn.owner_id,conn.google_calendar,p_args->>'google_id',event_id,item.version,p_args->>'google_version',now())
   on conflict(owner_id,google_calendar,google_id) do update set mycel_version=excluded.mycel_version,google_version=excluded.google_version,recorded_at=now();
 else
   if conn.direction='export'  then raise exception '변경 미리보기 승인이 필요합니다.'; end if;
   if p_tool not in ('calendar_create_event','calendar_update_event','calendar_delete_event') then raise exception '지원되지 않는 도구'; end if;
   if p_tool<>'calendar_create_event' and (item.id is null or item.trashed or item.version is distinct from (p_args->>'version')::bigint) then raise exception '일정 버전 충돌'; end if;
   insert into public.calendar_proposals(owner_id,request_id,signature,tool,args)
    values(conn.owner_id,req,request_hash,p_tool,p_args) on conflict do nothing;
   if not exists(select 1 from public.calendar_proposals where owner_id=conn.owner_id and request_id=req and signature=request_hash and expires_at>now()) then raise exception '승인 요청이 달라졌거나 만료되었습니다.'; end if;
   if not exists(select 1 from public.calendar_proposals where owner_id=conn.owner_id and request_id=req and approved) then return jsonb_build_object('status','approval_required','request_id',req); end if;
   if p_tool='calendar_delete_event' then
     update public.workspace_items set trashed=true,version=version+1,updated_at=now() where id=event_id returning * into item;
   else
     patch:=coalesce(p_args->'body','{}');
     if jsonb_typeof(patch)<>'object' or octet_length(patch::text)>40000 or exists(select 1 from jsonb_object_keys(patch) k where k not in ('start','end','all_day','location','description','cancelled','timezone','recurrence_rule','recurrence_instance_id')) then raise exception '잘못된 일정 필드'; end if;
     fields:=coalesce(item.body,'{}')||patch;
     next_title:=trim(coalesce(p_args->>'title',item.title,''));
     if length(next_title) not between 1 and 200 or fields->>'start' is null or fields->>'end' is null or (fields->>'start')::timestamp>(fields->>'end')::timestamp then raise exception '제목과 일정을 확인하세요.'; end if;
     if p_tool='calendar_create_event' then
       insert into public.workspace_items(id,kind,owner_id,title,body) values(event_id,'event',conn.owner_id,next_title,fields) returning * into item;
     else
       update public.workspace_items set body=fields,title=next_title,version=version+1,updated_at=now() where id=event_id returning * into item;
     end if;
   end if;
   insert into public.workspace_history(item_id,actor,revision,action,snapshot)
    values(event_id,conn.owner_id,item.version,'캘린더 동기화',public.workspace_snapshot(event_id));
 end if;
 result:=jsonb_build_object('id',event_id,'version',item.version,'trashed',item.trashed);
 insert into public.calendar_sync_requests(owner_id,request_id,signature,result) values(conn.owner_id,req,request_hash,result);
 return result;
end $$;
revoke all on function public.calendar_connect(text,text),public.calendar_disconnect(),public.calendar_pair(uuid,text),public.calendar_connector(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.calendar_connect(text,text),public.calendar_disconnect() to authenticated;
grant execute on function public.calendar_pair(uuid,text),public.calendar_connector(text,text,jsonb) to anon;
commit;

