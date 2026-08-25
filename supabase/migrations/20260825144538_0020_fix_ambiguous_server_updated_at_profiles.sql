create or replace function public.save_profile(
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
    insert into public.profiles (user_id, payload, client_updated_at)
    values (v_uid, p_payload, p_client_updated_at)
    on conflict (user_id) do nothing;
  else
    update public.profiles
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.profiles.user_id = v_uid
      and public.profiles.server_updated_at = p_expected_server_updated_at;
  end if;

  return query
    select p.server_updated_at from public.profiles p
    where p.user_id = v_uid;
end;
$$;

create or replace function public.delete_profile(
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

  update public.profiles
  set deleted_at = now()
  where public.profiles.user_id = v_uid
    and public.profiles.server_updated_at = p_expected_server_updated_at;

  return query
    select p.server_updated_at from public.profiles p
    where p.user_id = v_uid;
end;
$$;
