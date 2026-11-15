begin;
create table public.chat_polls(id uuid primary key,message_id uuid not null references public.messages(id),room_id uuid not null references public.chat_rooms(id),creator uuid not null references public.profiles(id),question text not null,options text[] not null,closes_at timestamptz not null,closed boolean not null default false);
create table public.chat_poll_votes(poll_id uuid references public.chat_polls(id),user_id uuid references public.profiles(id),choice integer not null,primary key(poll_id,user_id));
create table public.scheduled_messages(id uuid primary key,room_id uuid not null references public.chat_rooms(id),sender_id uuid not null references public.profiles(id),body text not null,send_at timestamptz not null,status text not null default 'pending' check(status in ('pending','sent','cancelled','failed')),updated_at timestamptz not null default clock_timestamp(),message_id uuid references public.messages(id),error text);
create index scheduled_messages_due on public.scheduled_messages(send_at) where status='pending';
alter table public.chat_polls enable row level security;
alter table public.chat_poll_votes enable row level security;
alter table public.scheduled_messages enable row level security;
revoke all on public.chat_polls,public.chat_poll_votes,public.scheduled_messages from public,anon,authenticated;
create function public.create_chat_poll(p_id uuid,p_room uuid,p_question text,p_options text[],p_closes timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.messages;p public.chat_polls;
begin
 perform public.assert_room_write(p_room);
 perform pg_advisory_xact_lock(hashtextextended('poll:'||p_id::text,0));
 select * into p from public.chat_polls where id=p_id;
 if found then
  if p.creator=auth.uid() and p.room_id=p_room and p.question=trim(p_question) and p.options=p_options and p.closes_at=p_closes then return p_id;end if;raise exception 'Idempotency conflict';
 end if;
 if p_id is null or p_question is null or char_length(trim(p_question)) not between 1 and 200 or coalesce(cardinality(p_options),0) not between 2 and 10 or exists(select 1 from unnest(p_options) o where o is null or char_length(trim(o)) not between 1 and 100) or (select count(distinct trim(o)) from unnest(p_options) o)<>cardinality(p_options) or p_closes is null or p_closes<now()+interval '1 minute' or p_closes>now()+interval '30 days' then raise exception '질문, 서로 다른 선택지 2~10개, 1분~30일 이내 마감을 입력해 주세요.';end if;
 m:=public.send_message(p_room,'[공개투표] '||trim(p_question),p_id);
 insert into public.chat_polls values(p_id,m.id,p_room,auth.uid(),trim(p_question),p_options,p_closes,false);return p_id;
end $$;
create function public.vote_chat_poll(p_id uuid,p_choice integer) returns void language plpgsql security definer set search_path='' as $$
declare p public.chat_polls;
begin
 select * into p from public.chat_polls where id=p_id for update;
 perform public.assert_room_write(p.room_id);
 if not exists(select 1 from public.messages where id=p.message_id and deleted_at is null and public.can_read_chat_sequence(room_id,sequence)) then raise exception '투표 접근 권한이 없습니다.';end if;
 if p.closed or p.closes_at<=now() then raise exception '마감된 투표입니다.';end if;
 if p_choice is null or p_choice<1 or p_choice>cardinality(p.options) then raise exception '선택지를 확인해 주세요.';end if;
 insert into public.chat_poll_votes values(p_id,auth.uid(),p_choice) on conflict(poll_id,user_id) do update set choice=excluded.choice;
end $$;
create function public.close_chat_poll(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.chat_polls;
begin
 select * into p from public.chat_polls where id=p_id for update;
 perform public.assert_room_write(p.room_id);
 if not exists(select 1 from public.messages where id=p.message_id and deleted_at is null and public.can_read_chat_sequence(room_id,sequence)) or (p.creator<>auth.uid() and not exists(select 1 from public.chat_rooms where id=p.room_id and group_mode='team' and public.group_manager(id))) then raise exception '투표 작성자 또는 팀 관리자만 마감할 수 있습니다.';end if;
 update public.chat_polls set closed=true where id=p_id;
end $$;
create function public.save_scheduled_message(p_id uuid,p_room uuid,p_body text,p_send_at timestamptz,p_expected timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare s public.scheduled_messages;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 perform pg_advisory_xact_lock(hashtextextended('schedule:'||auth.uid()::text,0));
 select * into s from public.scheduled_messages where id=p_id for update;
 if found then
  if s.sender_id<>auth.uid() or s.room_id<>p_room then raise exception '예약 접근 권한이 없습니다.';end if;
  if s.status='pending' and s.body=trim(p_body) and s.send_at=p_send_at then return;end if;
  if s.status<>'pending' or s.updated_at is distinct from p_expected then raise exception '예약이 변경되었거나 이미 처리되었습니다. 목록을 새로 확인해 주세요.';end if;
 else
  if (select count(*) from public.scheduled_messages where sender_id=auth.uid() and status='pending')>=100 then raise exception '예약은 최대 100개입니다.';end if;
 end if;
 perform public.assert_room_write(p_room);
 if p_id is null or p_body is null or char_length(trim(p_body)) not between 1 and 4000 or p_send_at is null or p_send_at<now()+interval '1 minute' or p_send_at>now()+interval '365 days' then raise exception '1~4000자 메시지와 1분~1년 이내 예약 시간을 입력해 주세요.';end if;
 insert into public.scheduled_messages(id,room_id,sender_id,body,send_at) values(p_id,p_room,auth.uid(),trim(p_body),p_send_at) on conflict(id) do update set body=excluded.body,send_at=excluded.send_at,updated_at=clock_timestamp();
end $$;
create function public.cancel_scheduled_message(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.scheduled_messages;
begin
 select * into s from public.scheduled_messages where id=p_id for update;
 if auth.uid() is null or s.sender_id is distinct from auth.uid() then raise exception '예약 접근 권한이 없습니다.';end if;
 if s.status='cancelled' then return;end if;
 if s.status<>'pending' then raise exception '이미 처리된 예약입니다.';end if;
 update public.scheduled_messages set status='cancelled',updated_at=clock_timestamp() where id=p_id;
end $$;
create function public.run_scheduled_messages() returns integer language plpgsql security definer set search_path='' as $$
declare s public.scheduled_messages;m public.messages;n integer:=0;prior_sub text:=current_setting('request.jwt.claim.sub',true);prior_claims text:=current_setting('request.jwt.claims',true);
begin
 for s in select * from public.scheduled_messages where status='pending' and send_at<=now() order by send_at for update skip locked limit 25 loop
  begin
   perform set_config('request.jwt.claim.sub',s.sender_id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',s.sender_id,'role','authenticated')::text,true);
   perform public.assert_room_write(s.room_id);
   m:=public.send_message(s.room_id,s.body,s.id);
   update public.scheduled_messages set status='sent',message_id=m.id,error=null,updated_at=clock_timestamp() where id=s.id;n:=n+1;
  exception when others then
   update public.scheduled_messages set status='failed',error='발송 실패: 대화방 접근·차단 상태 또는 전송 제한을 확인해 주세요.',updated_at=clock_timestamp() where id=s.id;
  end;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
 return n;
end $$;
create function public.get_room_tools(p_room uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_room_member(p_room) then raise exception '대화방 접근 권한이 없습니다.';end if;
 return jsonb_build_object('polls',(select coalesce(jsonb_agg(x),'[]') from (select p.*,p.closed or p.closes_at<=now() as ended,(select coalesce(jsonb_agg(jsonb_build_object('user_id',v.user_id,'name',u.display_name,'choice',v.choice)),'[]') from public.chat_poll_votes v join public.profiles u on u.id=v.user_id where v.poll_id=p.id) as votes from public.chat_polls p join public.messages m on m.id=p.message_id where p.room_id=p_room and m.deleted_at is null and public.can_read_chat_sequence(p_room,m.sequence) order by m.sequence desc limit 100)x),
 'scheduled',(select coalesce(jsonb_agg(x),'[]') from (select * from public.scheduled_messages where room_id=p_room and sender_id=auth.uid() order by send_at desc limit 100)x));
end $$;
revoke all on function public.run_scheduled_messages() from public,anon,authenticated;
revoke all on function public.create_chat_poll(uuid,uuid,text,text[],timestamptz),public.vote_chat_poll(uuid,integer),public.close_chat_poll(uuid),public.save_scheduled_message(uuid,uuid,text,timestamptz,timestamptz),public.cancel_scheduled_message(uuid),public.get_room_tools(uuid) from public,anon;
grant execute on function public.create_chat_poll(uuid,uuid,text,text[],timestamptz),public.vote_chat_poll(uuid,integer),public.close_chat_poll(uuid),public.save_scheduled_message(uuid,uuid,text,timestamptz,timestamptz),public.cancel_scheduled_message(uuid),public.get_room_tools(uuid) to authenticated;
commit;
