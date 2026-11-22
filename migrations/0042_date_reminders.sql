begin;
alter table public.note_mention_notifications add column kind text not null default 'person' check(kind in('person','date'));
alter table public.note_mention_notifications alter column room_id drop not null;
create table public.note_date_reminders(
 id uuid primary key default gen_random_uuid(),mention_id uuid not null,recipient uuid not null references public.profiles(id),
 note_id uuid not null references public.workspace_items(id),room_id uuid references public.chat_rooms(id),sync_id uuid references public.note_sync_blocks(id),
 signature text not null,event_at timestamptz not null,due_at timestamptz not null,time_zone text not null,
 created_at timestamptz not null default now(),delivered_at timestamptz,cancelled_at timestamptz,
 unique(mention_id,recipient,signature)
);
create index note_dates_due on public.note_date_reminders(due_at) where delivered_at is null and cancelled_at is null;
alter table public.note_date_reminders enable row level security;
revoke all on public.note_date_reminders from public,anon,authenticated;
grant all on public.note_date_reminders to service_role;

create function public.date_reminder_settings(p_attrs jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare day date;tm time;zone text:=coalesce(nullif(p_attrs->>'timeZone',''),'Asia/Seoul');choice text:=p_attrs->>'reminder';event_time timestamptz;due timestamptz;minutes integer;
begin
 if coalesce(choice,'none')='none' then return null;end if;
 if coalesce(p_attrs->>'target','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '올바른 날짜를 입력해 주세요.';end if;
 day:=(p_attrs->>'target')::date;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception '올바른 시간대를 선택해 주세요.';end if;
 if coalesce(p_attrs->>'time','')<>'' and (p_attrs->>'time')!~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception '올바른 시각을 입력해 주세요.';end if;
 tm:=coalesce(nullif(p_attrs->>'time',''),'09:00')::time;event_time:=(day+tm) at time zone zone;
 if event_time at time zone zone<>day+tm then raise exception '이 시간대에 존재하지 않는 시각입니다.';end if;
 if choice in('1d','2d') then due:=((day-case when choice='1d' then 1 else 2 end)+time '09:00') at time zone zone;
 else minutes:=case choice when 'at' then 0 when '5m' then 5 when '10m' then 10 when '15m' then 15 when '30m' then 30 when '1h' then 60 when '2h' then 120 else null end;
 if minutes is null then raise exception '올바른 리마인더를 선택해 주세요.';end if;due:=event_time-make_interval(mins=>minutes);end if;
 return jsonb_build_object('event_at',event_time,'due_at',due,'time_zone',zone,'signature',md5(jsonb_build_array(p_attrs->>'target',coalesce(p_attrs->>'time',''),zone,choice,p_attrs->>'reminderRevision',p_attrs->>'reminderUserId')::text));
end $$;
revoke all on function public.date_reminder_settings(jsonb) from public,anon,authenticated;
create function public.date_reminder_preview(p_attrs jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;result:=public.date_reminder_settings(p_attrs);if result is null or (result->>'due_at')::timestamptz<=now()then raise exception '알림 시각이 현재보다 이후가 되도록 설정해 주세요.';end if;return result||jsonb_build_object('user_id',auth.uid());end $$;
revoke all on function public.date_reminder_preview(jsonb)from public,anon;
grant execute on function public.date_reminder_preview(jsonb)to authenticated;

create function public.date_reminder_access(p_user uuid,p_note uuid,p_room uuid,p_sync uuid)returns boolean language plpgsql security definer set search_path='' as $$
declare previous text:=current_setting('request.jwt.claim.sub',true);permitted boolean;
begin
 if p_room is not null then return public.note_mention_access(p_user,p_note,p_room,p_sync);end if;
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 permitted:=coalesce(public.workspace_permission(p_note),0)>0 and not exists(with recursive chain as(select id,parent_id,trashed from public.workspace_items where id=p_note union all select i.id,i.parent_id,i.trashed from public.workspace_items i join chain c on c.parent_id=i.id)select 1 from chain where trashed);
 if p_sync is not null then permitted:=permitted and exists(select 1 from public.note_sync_blocks s where id=p_sync and public.workspace_permission(s.source_note)>0 and not exists(select 1 from public.workspace_items where id in(s.source_note,public.workspace_root(s.source_note))and trashed));end if;
 perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);return coalesce(permitted,false);
exception when others then perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);raise;
end $$;
revoke all on function public.date_reminder_access(uuid,uuid,uuid,uuid)from public,anon,authenticated;

create function public.date_reminder_matches(p_content jsonb,p_reminder public.note_date_reminders)returns boolean language plpgsql stable set search_path='' as $$
declare node jsonb;s jsonb;
begin
 for node in select q.value from jsonb_path_query(p_content,'$.** ? (@.type == "pageMention" && @.attrs.kind == "date" && @.attrs.mentionId == $id)',jsonb_build_object('id',p_reminder.mention_id::text))q(value) loop
 begin s:=public.date_reminder_settings(node->'attrs');if (node->'attrs'->>'reminderUserId')=p_reminder.recipient::text and s->>'signature'=p_reminder.signature then return true;end if;exception when others then null;end;
 end loop;return false;
end $$;
revoke all on function public.date_reminder_matches(jsonb,public.note_date_reminders)from public,anon,authenticated;
create function public.date_reminder_location(p_id uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.note_date_reminders;b public.note_blocks;
begin select * into r from public.note_date_reminders where id=p_id and cancelled_at is null;if not found then return null;end if;
 if r.sync_id is null then
 select * into b from public.note_blocks where not deleted and public.date_reminder_matches(content,r) and public.date_reminder_access(r.recipient,item_id,r.room_id,null) order by(item_id=r.note_id)desc limit 1;
 else
 if not exists(select 1 from public.note_sync_blocks where id=r.sync_id and public.date_reminder_matches(content,r))then return null;end if;
 select * into b from public.note_blocks where item_id=r.note_id and not deleted and jsonb_path_exists(content,'$.** ? (@.type == "syncedBlock" && @.attrs.syncId == $id)',jsonb_build_object('id',r.sync_id::text)) and public.date_reminder_access(r.recipient,item_id,r.room_id,r.sync_id)limit 1;
 end if;if b.id is null then return null;end if;
 return jsonb_build_object('note_id',b.item_id,'block_id',b.id,'room_id',r.room_id,'mention_id',r.mention_id);
end $$;
revoke all on function public.date_reminder_location(uuid)from public,anon,authenticated;

create function public.record_date_reminders(p_note uuid,p_content jsonb,p_sync uuid default null)returns void language plpgsql security definer set search_path='' as $$
declare node jsonb;s jsonb;mid uuid;room uuid;person uuid;actor uuid:=auth.uid();
begin
 if actor is null or coalesce(public.workspace_permission(p_note),0)<3 then return;end if;
 for node in select distinct q.value from jsonb_path_query(p_content,'$.** ? (@.type == "pageMention" && @.attrs.kind == "date")')q(value)loop
 begin
 mid:=(node->'attrs'->>'mentionId')::uuid;person:=nullif(node->'attrs'->>'reminderUserId','')::uuid;room:=nullif(node->'attrs'->>'roomId','')::uuid;
 if mid is null or person is distinct from actor or coalesce(node->'attrs'->>'reminderRevision','')='' then continue;end if;
 if not public.date_reminder_access(actor,p_note,room,p_sync)then continue;end if;
 s:=public.date_reminder_settings(node->'attrs');if s is null or (s->>'due_at')::timestamptz<=now()then continue;end if;
 insert into public.note_date_reminders(mention_id,recipient,note_id,room_id,sync_id,signature,event_at,due_at,time_zone)values(mid,actor,p_note,room,p_sync,s->>'signature',(s->>'event_at')::timestamptz,(s->>'due_at')::timestamptz,s->>'time_zone')on conflict do nothing;
 exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then continue;
 end;
 end loop;
 -- Persisted content is the source of truth; a stale retry cannot re-arm a reminder.
 update public.note_date_reminders r set cancelled_at=now()where r.note_id=p_note and r.sync_id is not distinct from p_sync and r.cancelled_at is null and public.date_reminder_location(r.id)is null;
end $$;
revoke all on function public.record_date_reminders(uuid,jsonb,uuid)from public,anon,authenticated;
alter function public.record_note_mentions(uuid,jsonb,uuid)rename to record_note_mentions_before_dates;
create function public.record_note_mentions(p_note uuid,p_content jsonb,p_sync uuid default null)returns void language plpgsql security definer set search_path='' as $$
begin perform public.record_note_mentions_before_dates(p_note,p_content,p_sync);perform public.record_date_reminders(p_note,p_content,p_sync);end $$;
revoke all on function public.record_note_mentions(uuid,jsonb,uuid),public.record_note_mentions_before_dates(uuid,jsonb,uuid)from public,anon,authenticated;

create function public.process_date_reminders()returns integer language plpgsql security definer set search_path='' as $$
declare r public.note_date_reminders;loc jsonb;total integer:=0;
begin
 for r in select * from public.note_date_reminders where delivered_at is null and cancelled_at is null and due_at<=now()order by due_at for update skip locked limit 100 loop
 loc:=public.date_reminder_location(r.id);
 if loc is null then update public.note_date_reminders set cancelled_at=now()where id=r.id;continue;end if;
 insert into public.note_mention_notifications(id,recipient,actor,note_id,room_id,sync_id,kind)values(r.id,r.recipient,r.recipient,(loc->>'note_id')::uuid,r.room_id,r.sync_id,'date')on conflict do nothing;
 insert into public.push_jobs(mention_id,device_id)select r.id,d.id from public.push_devices d where d.user_id=r.recipient and not exists(select 1 from public.room_preferences where room_id=r.room_id and user_id=r.recipient and muted)on conflict do nothing;
 update public.note_date_reminders set delivered_at=now()where id=r.id;total:=total+1;
 end loop;return total;
end $$;
revoke all on function public.process_date_reminders()from public,anon,authenticated;
grant execute on function public.process_date_reminders()to service_role;
alter function public.note_mention_location(uuid)rename to person_mention_location;
create function public.note_mention_location(p_id uuid)returns jsonb language plpgsql security definer set search_path='' as $$
begin if exists(select 1 from public.note_mention_notifications where id=p_id and kind='date')then return public.date_reminder_location(p_id);end if;return public.person_mention_location(p_id);end $$;
revoke all on function public.note_mention_location(uuid),public.person_mention_location(uuid)from public,anon,authenticated;
create or replace function public.note_mentions_inbox()returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin if auth.uid()is null then raise exception '로그인이 필요합니다.';end if;
 select coalesce(jsonb_agg(x order by x.created_at desc),'[]')into result from(
 select n.id,n.kind,n.created_at,n.read_at,p.display_name as actor_name,(select title from public.workspace_items where id=(loc->>'note_id')::uuid)as note_title,
 case when n.kind='date' then to_char(r.event_at at time zone r.time_zone,'YYYY-MM-DD HH24:MI')||' · '||r.time_zone else null end as event_label
 from(select * from public.note_mention_notifications where recipient=auth.uid()order by created_at desc limit 100)n
 join public.profiles p on p.id=n.actor left join public.note_date_reminders r on r.id=n.id cross join lateral(select public.note_mention_location(n.id)as loc)l where loc is not null)x;return result;
end $$;
-- Existing push dispatcher and click routing use the notification ID. The resolver returns the date mention ID.
alter function public.claim_push_jobs()rename to claim_push_jobs_before_dates;
create function public.claim_push_jobs()returns jsonb language plpgsql security definer set search_path='' as $$
declare jobs jsonb;result jsonb;
begin jobs:=public.claim_push_jobs_before_dates();select coalesce(jsonb_agg(j||jsonb_build_object('notification_kind',n.kind)),'[]')into result from jsonb_array_elements(jobs)j left join public.note_mention_notifications n on n.id=(j->>'mention_id')::uuid;return result;end $$;
revoke all on function public.claim_push_jobs(),public.claim_push_jobs_before_dates()from public,anon,authenticated;
grant execute on function public.claim_push_jobs()to service_role;
select cron.schedule('mycel-date-reminders','* * * * *','select public.process_date_reminders()');
commit;