begin;
-- Keep existing public polls public; new poll defaults are anonymous.
alter table public.chat_polls add column anonymous boolean not null default false;
alter table public.chat_polls alter column anonymous set default true;
alter table public.chat_polls add column max_choices integer not null default 1 check(max_choices between 1 and 10 and max_choices<=cardinality(options));
alter table public.chat_poll_votes drop constraint chat_poll_votes_pkey;
alter table public.chat_poll_votes add primary key(poll_id,user_id,choice);
create function public.create_chat_poll(p_id uuid,p_room uuid,p_question text,p_options text[],p_closes timestamptz,p_anonymous boolean,p_max_choices integer) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.messages;p public.chat_polls;
begin
 perform public.assert_room_write(p_room);
 perform pg_advisory_xact_lock(hashtextextended('poll:'||p_id::text,0));
 select * into p from public.chat_polls where id=p_id;
 if found then
  if p.creator=auth.uid() and p.room_id=p_room and p.question=trim(p_question) and p.options=p_options and p.closes_at=p_closes and p.anonymous=p_anonymous and p.max_choices=p_max_choices then return p_id;end if;raise exception 'Idempotency conflict';
 end if;
 if p_anonymous is null or p_max_choices is null or p_max_choices<1 or p_max_choices>coalesce(cardinality(p_options),0) then raise exception '최대 선택 개수를 확인해 주세요.';end if;
 if p_id is null or p_question is null or char_length(trim(p_question)) not between 1 and 200 or coalesce(cardinality(p_options),0) not between 2 and 10 or exists(select 1 from unnest(p_options) o where o is null or char_length(trim(o)) not between 1 and 100) or (select count(distinct trim(o)) from unnest(p_options) o)<>cardinality(p_options) or p_closes is null or p_closes<now()+interval '1 minute' or p_closes>now()+interval '30 days' then raise exception '질문, 서로 다른 선택지 2~10개, 1분~30일 이내 마감을 입력해 주세요.';end if;
 m:=public.send_message(p_room,'[투표] '||trim(p_question),p_id);
 insert into public.chat_polls(id,message_id,room_id,creator,question,options,closes_at,closed,anonymous,max_choices) values(p_id,m.id,p_room,auth.uid(),trim(p_question),p_options,p_closes,false,p_anonymous,p_max_choices);return p_id;
end $$;
create function public.vote_chat_poll_choices(p_id uuid,p_choices integer[]) returns void language plpgsql security definer set search_path='' as $$
declare p public.chat_polls;
begin
 select * into p from public.chat_polls where id=p_id for update;
 perform public.assert_room_write(p.room_id);
 if not exists(select 1 from public.messages where id=p.message_id and deleted_at is null and public.can_read_chat_sequence(room_id,sequence)) then raise exception '투표 접근 권한이 없습니다.';end if;
 if p.closed or p.closes_at<=now() then raise exception '마감된 투표입니다.';end if;
 if coalesce(cardinality(p_choices),0)<1 or cardinality(p_choices)>p.max_choices or exists(select 1 from unnest(p_choices) c where c is null or c<1 or c>cardinality(p.options)) or (select count(distinct c) from unnest(p_choices) c)<>cardinality(p_choices) then raise exception '선택 가능한 개수와 항목을 확인해 주세요.';end if;
 delete from public.chat_poll_votes where poll_id=p_id and user_id=auth.uid();
 insert into public.chat_poll_votes select p_id,auth.uid(),c from unnest(p_choices) c;
end $$;

-- Old clients keep their explicit public, single-choice behavior.
create or replace function public.create_chat_poll(p_id uuid,p_room uuid,p_question text,p_options text[],p_closes timestamptz) returns uuid language sql security definer set search_path='' as $$
 select public.create_chat_poll(p_id,p_room,p_question,p_options,p_closes,false,1)
$$;
create or replace function public.vote_chat_poll(p_id uuid,p_choice integer) returns void language sql security definer set search_path='' as $$
 select public.vote_chat_poll_choices(p_id,array[p_choice])
$$;
create or replace function public.get_room_tools(p_room uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_room_member(p_room) then raise exception '대화방 접근 권한이 없습니다.';end if;
 return jsonb_build_object('polls',(select coalesce(jsonb_agg(x),'[]') from (select p.*,p.closed or p.closes_at<=now() as ended,case when p.anonymous then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('user_id',v.user_id,'name',u.display_name,'choice',v.choice)),'[]') from public.chat_poll_votes v join public.profiles u on u.id=v.user_id where v.poll_id=p.id) end as votes,
 (select coalesce(jsonb_agg(v.choice order by v.choice),'[]') from public.chat_poll_votes v where v.poll_id=p.id and v.user_id=auth.uid()) as my_choices,
 (select coalesce(jsonb_agg((select count(*) from public.chat_poll_votes v where v.poll_id=p.id and v.choice=i) order by i),'[]') from generate_series(1,cardinality(p.options)) i) as counts,
 (select count(distinct user_id) from public.chat_poll_votes where poll_id=p.id) as voter_count from public.chat_polls p join public.messages m on m.id=p.message_id where p.room_id=p_room and m.deleted_at is null and public.can_read_chat_sequence(p_room,m.sequence) order by m.sequence desc limit 100)x),
 'scheduled',(select coalesce(jsonb_agg(x),'[]') from (select * from public.scheduled_messages where room_id=p_room and sender_id=auth.uid() order by send_at desc limit 100)x));
end $$;

revoke all on function public.create_chat_poll(uuid,uuid,text,text[],timestamptz,boolean,integer),public.vote_chat_poll_choices(uuid,integer[]) from public,anon;
grant execute on function public.create_chat_poll(uuid,uuid,text,text[],timestamptz,boolean,integer),public.vote_chat_poll_choices(uuid,integer[]) to authenticated;
commit;
