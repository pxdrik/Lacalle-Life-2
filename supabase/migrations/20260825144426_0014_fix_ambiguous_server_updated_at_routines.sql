create or replace function public.save_routine(
  p_id uuid,
  p_payload jsonb,
  p_client_updated_at bigint,
  p_expected_server_updated_at timestamptz
) returns table (server_updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_expected_server_updated_at is null then
    insert into public.routines (id, user_id, payload, client_updated_at)
    values (p_id, v_uid, p_payload, p_client_updated_at)
    on conflict (id) do nothing;
  else
    update public.routines
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.routines.id = p_id
      and public.routines.user_id = v_uid
      and public.routines.server_updated_at = p_expected_server_updated_at;
  end if;

  return query
    select r.server_updated_at from public.routines r
    where r.id = p_id and r.user_id = v_uid;
end;
$$;

create or replace function public.delete_routine(
  p_id uuid,
  p_expected_server_updated_at timestamptz
) returns table (server_updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update public.routines
  set deleted_at = now()
  where public.routines.id = p_id
    and public.routines.user_id = v_uid
    and public.routines.server_updated_at = p_expected_server_updated_at;

  return query
    select r.server_updated_at from public.routines r
    where r.id = p_id and r.user_id = v_uid;
end;
$$;
