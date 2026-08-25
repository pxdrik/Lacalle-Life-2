create or replace function public.save_user_custom_exercise(
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
    insert into public.user_custom_exercises (id, user_id, payload, client_updated_at)
    values (p_id, v_uid, p_payload, p_client_updated_at)
    on conflict (id) do nothing;
  else
    update public.user_custom_exercises
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.user_custom_exercises.id = p_id
      and public.user_custom_exercises.user_id = v_uid
      and public.user_custom_exercises.server_updated_at = p_expected_server_updated_at;
  end if;

  return query
    select e.server_updated_at from public.user_custom_exercises e
    where e.id = p_id and e.user_id = v_uid;
end;
$$;

create or replace function public.delete_user_custom_exercise(
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

  update public.user_custom_exercises
  set deleted_at = now()
  where public.user_custom_exercises.id = p_id
    and public.user_custom_exercises.user_id = v_uid
    and public.user_custom_exercises.server_updated_at = p_expected_server_updated_at;

  return query
    select e.server_updated_at from public.user_custom_exercises e
    where e.id = p_id and e.user_id = v_uid;
end;
$$;
