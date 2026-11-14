begin;
create table public.friend_invites(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
 token_hash text not null unique, created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',revoked_at timestamptz
);
create index friend_invites_owner on public.friend_invites(owner_id,created_at);
create table public.pending_friend_invites(user_id uuid primary key references public.profiles(id),invite_id uuid not null references public.friend_invites(id),created_at timestamptz not null default now());
alter table public.friend_invites enable row level security;
alter table public.pending_friend_invites enable row level security;
revoke all on public.friend_invites,public.pending_friend_invites from public,anon,authenticated;
create function public.create_friend_invite() returns jsonb language plpgsql security definer set search_path='' as $$
declare t text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');r public.friend_invites;
begin
 if not public.social_quota('invite_create',20,86400) then return jsonb_build_object('error','초대 링크는 하루에 20개까지 만들 수 있습니다.'); end if;
 perform pg_advisory_xact_lock(hashtextextended('invite-owner:'||auth.uid()::text,0));
 if (select count(*) from public.friend_invites where owner_id=auth.uid() and revoked_at is null and expires_at>now())>=10 then return jsonb_build_object('error','사용 중인 초대 링크가 10개입니다. 이전 링크를 만료시킨 후 만들어 주세요.'); end if;
 insert into public.friend_invites(owner_id,token_hash) values(auth.uid(),encode(sha256(convert_to(t,'UTF8')),'hex')) returning * into r;
 return jsonb_build_object('id',r.id,'token',t,'expires_at',r.expires_at);
end $$;
create function public.list_friend_invites() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'created_at',created_at,'expires_at',expires_at,'revoked_at',revoked_at) order by created_at desc),'[]') from (select * from public.friend_invites where owner_id=auth.uid() order by created_at desc limit 20) i;
$$;
create function public.revoke_friend_invite(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 update public.friend_invites set revoked_at=coalesce(revoked_at,now()) where id=p_id and owner_id=auth.uid();
 if not found then return jsonb_build_object('error','초대 링크를 찾을 수 없습니다.');end if;
 return jsonb_build_object('ok',true);
end $$;
create function public.invite_state(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.friend_invites;p public.profiles;f public.friendships;a uuid:=auth.uid();s text:='ready';
begin
 select * into r from public.friend_invites where id=p_id and revoked_at is null and expires_at>now();
 if not found then return jsonb_build_object('error','만료되었거나 사용할 수 없는 초대 링크입니다.','invite_id',case when a is not null then p_id else null end);end if;
 select * into p from public.profiles where id=r.owner_id;
 if a is null then return jsonb_build_object('name',p.display_name,'status','login','expires_at',r.expires_at);end if;
 if a=p.id then s:='self';
 elsif public.social_blocked(a,p.id) then return jsonb_build_object('error','이 초대 링크로 친구 요청을 보낼 수 없습니다.','invite_id',r.id);
 else
 select * into f from public.friendships where low_id=least(a,p.id) and high_id=greatest(a,p.id);
 if found and f.status='accepted' then s:='accepted';
 elsif found and f.status='pending' then s:=case when f.requested_by=a then 'pending' else 'incoming' end;
 end if;
 end if;
 return jsonb_build_object('invite_id',r.id,'name',p.display_name,'username',p.username,'status',s,'expires_at',r.expires_at);
end $$;
create function public.resolve_friend_invite(p_token text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k uuid;
begin
 if p_token is not null then
 if p_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','올바른 초대 링크가 아닙니다.');end if;
 select id into k from public.friend_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 else select invite_id into k from public.pending_friend_invites where user_id=auth.uid();if not found then return jsonb_build_object('none',true);end if;
 end if;
 return public.invite_state(k);
end $$;
create function public.remember_friend_invite(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare k uuid; state jsonb;
begin
 if not public.social_quota('invite_remember',30,60) then return jsonb_build_object('error','잠시 후 다시 열어 주세요.');end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','올바른 초대 링크가 아닙니다.');end if;
 select id into k from public.friend_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 state:=public.invite_state(k);
 if state ? 'error' or state->>'status'='self' then return state;end if;
 insert into public.pending_friend_invites values(auth.uid(),k,now()) on conflict(user_id) do update set invite_id=excluded.invite_id,created_at=now();
 return state;
end $$;
create function public.dismiss_friend_invite(p_invite_id uuid) returns void language sql security definer set search_path='' as $$
 delete from public.pending_friend_invites where user_id=auth.uid() and invite_id=p_invite_id;
$$;
create function public.request_invited_friend(p_invite_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.friend_invites;result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select i.* into r from public.friend_invites i join public.pending_friend_invites p on p.invite_id=i.id where p.user_id=auth.uid() for share of i;
 if not found or r.id is distinct from p_invite_id or r.revoked_at is not null or r.expires_at<=now() then return jsonb_build_object('error','만료되었거나 사용할 수 없는 초대 링크입니다.');end if;
 result:=public.request_friend(r.owner_id);
 if result->>'ok'='true' then delete from public.pending_friend_invites where user_id=auth.uid();end if;
 return result;
end $$;
create function public.capture_signup_invite() returns trigger language plpgsql security definer set search_path='' as $$
declare t text;k uuid;
begin
 select raw_user_meta_data->>'invite_token' into t from auth.users where id=new.id;
 if t ~ '^[a-f0-9]{64}$' then
 select id into k from public.friend_invites where token_hash=encode(sha256(convert_to(t,'UTF8')),'hex') and revoked_at is null and expires_at>now() and owner_id<>new.id;
 if found then insert into public.pending_friend_invites values(new.id,k,now()) on conflict(user_id) do nothing;end if;
 end if;
 return new;
end $$;
create trigger capture_signup_invite after insert on public.profiles for each row execute function public.capture_signup_invite();
revoke all on function public.capture_signup_invite(),public.invite_state(uuid),public.create_friend_invite(),public.list_friend_invites(),public.revoke_friend_invite(uuid),public.resolve_friend_invite(text),public.remember_friend_invite(text),public.dismiss_friend_invite(uuid),public.request_invited_friend(uuid) from public,anon,authenticated;
grant execute on function public.resolve_friend_invite(text) to anon,authenticated;
grant execute on function public.create_friend_invite(),public.list_friend_invites(),public.revoke_friend_invite(uuid),public.remember_friend_invite(text),public.dismiss_friend_invite(uuid),public.request_invited_friend(uuid) to authenticated;
commit;
