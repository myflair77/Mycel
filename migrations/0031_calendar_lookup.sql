begin;

-- Calendar connector read surface. Return only the signed-in owner's personal
-- events and calendar fields. The JSON body may also contain meeting notes.
create function public.calendar_get_event(p_id uuid)
returns table (
  id uuid, title text, starts_local text, ends_local text,
  all_day boolean, description text, location text, cancelled boolean,
  trashed boolean, version bigint, updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.title, i.body->>'start', i.body->>'end',
         coalesce(i.body->>'all_day' = 'true', false),
         i.body->>'description', i.body->>'location',
         coalesce(i.body->>'cancelled' = 'true', false),
         i.trashed, i.version, i.updated_at
    from public.workspace_items i
   where i.id = p_id and i.kind = 'event' and i.space_id is null
     and i.owner_id = auth.uid() and public.workspace_permission(i.id) > 0;
$$;

revoke all on function public.calendar_get_event(uuid) from public, anon;
grant execute on function public.calendar_get_event(uuid) to authenticated;

commit;
