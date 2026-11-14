begin;
alter table public.profiles add column if not exists username_changed_at timestamptz;
create table public.retired_usernames(username text primary key, owner_id uuid not null references public.profiles(id), reserved_until timestamptz not null);
alter table public.retired_usernames enable row level security;
revoke all on public.retired_usernames from public,anon,authenticated;
create function public.guard_profile_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('profile-names',0));
 new.username:=lower(trim(new.username));
 if new.username !~ '^[a-z0-9_]{3,24}$' then raise exception '아이디는 영문 소문자·숫자·밑줄 3~24자로 입력해 주세요.'; end if;
 if tg_op='UPDATE' and new.username=old.username then return new; end if;
 if exists(select 1 from public.retired_usernames where username=new.username and reserved_until>now()) then raise exception '사용할 수 없는 아이디입니다.'; end if;
 if tg_op='UPDATE' then
  if old.username_changed_at>now()-interval '30 days' then raise exception '아이디는 30일에 한 번 변경할 수 있습니다.'; end if;
  insert into public.retired_usernames values(old.username,old.id,now()+interval '30 days')
   on conflict(username) do update set owner_id=excluded.owner_id,reserved_until=excluded.reserved_until;
  new.username_changed_at:=now();
 end if;
 return new;
end $$;
create trigger guard_profile_identity before insert or update of username on public.profiles for each row execute function public.guard_profile_identity();
create function public.check_username(p_username text) returns jsonb language plpgsql security definer set search_path='' as $$
declare n text:=lower(trim(p_username));
begin
 if not public.social_quota('username_check',20,60) then return jsonb_build_object('error','중복 확인은 1분에 20회까지 가능합니다.'); end if;
 if n is null or n !~ '^[a-z0-9_]{3,24}$' then return jsonb_build_object('error','영문·숫자·밑줄 3~24자로 입력해 주세요.'); end if;
 return jsonb_build_object('available',not exists(select 1 from public.profiles where username=n) and not exists(select 1 from public.retired_usernames where username=n and reserved_until>now()));
end $$;
create function public.update_my_profile(p_display_name text default null,p_username text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p public.profiles;
begin
 if not public.social_quota('profile_update',10,60) then return jsonb_build_object('error','잠시 후 다시 변경해 주세요.'); end if;
 if p_display_name is not null and char_length(trim(p_display_name)) not between 1 and 30 then return jsonb_build_object('error','닉네임은 1~30자로 입력해 주세요.'); end if;
 begin
  perform pg_advisory_xact_lock(hashtextextended('profile-names',0));
  update public.profiles set display_name=coalesce(trim(p_display_name),display_name),username=coalesce(lower(trim(p_username)),username) where id=actor returning * into p;
  if not found then raise exception '프로필을 찾을 수 없습니다.'; end if;
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('username',p.username,'display_name',p.display_name) where id=actor;
 exception when unique_violation then return jsonb_build_object('error','사용할 수 없는 아이디입니다.');
 when raise_exception then return jsonb_build_object('error',sqlerrm);
 end;
 return jsonb_build_object('profile',to_jsonb(p));
end $$;
revoke all on function public.guard_profile_identity(),public.check_username(text),public.update_my_profile(text,text) from public,anon,authenticated;
grant execute on function public.check_username(text),public.update_my_profile(text,text) to authenticated;
commit;
