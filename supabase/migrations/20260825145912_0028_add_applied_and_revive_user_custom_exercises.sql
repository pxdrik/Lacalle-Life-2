drop function public.save_user_custom_exercise(uuid, jsonb, bigint, timestamptz);
drop function public.delete_user_custom_exercise(uuid, timestamptz);

create or replace function public.save_user_custom_exercise(
  p_id uuid,
  p_payload jsonb,
  p_client_updated_at bigint,
  p_expected_server_updated_at timestamptz
) returns table (server_updated_at timestamptz, applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_expected_server_updated_at is null then
    insert into public.user_custom_exercises (id, user_id, payload, client_updated_at)
    values (p_id, v_uid, p_payload, p_client_updated_at)
    on conflict (id) do update
      set payload = excluded.payload,
          client_updated_at = excluded.client_updated_at,
          deleted_at = null
      where public.user_custom_exercises.deleted_at is not null
        and public.user_custom_exercises.user_id = v_uid;
    get diagnostics v_row_count = row_count;
  else
    update public.user_custom_exercises
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.user_custom_exercises.id = p_id
      and public.user_custom_exercises.user_id = v_uid
      and public.user_custom_exercises.server_updated_at = p_expected_server_updated_at;
    get diagnostics v_row_count = row_count;
  end if;

  return query
    select e.server_updated_at, (v_row_count > 0) as applied
    from public.user_custom_exercises e
    where e.id = p_id and e.user_id = v_uid;
end;
$$;

revoke execute on function public.save_user_custom_exercise from public;
revoke execute on function public.save_user_custom_exercise from anon;
grant execute on function public.save_user_custom_exercise to authenticated;

create or replace function public.delete_user_custom_exercise(
  p_id uuid,
  p_expected_server_updated_at timestamptz
) returns table (server_updated_at timestamptz, applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update public.user_custom_exercises
  set deleted_at = now()
  where public.user_custom_exercises.id = p_id
    and public.user_custom_exercises.user_id = v_uid
    and public.user_custom_exercises.server_updated_at = p_expected_server_updated_at;
  get diagnostics v_row_count = row_count;

  return query
    select e.server_updated_at, (v_row_count > 0) as applied
    from public.user_custom_exercises e
    where e.id = p_id and e.user_id = v_uid;
end;
$$;

revoke execute on function public.delete_user_custom_exercise from public;
revoke execute on function public.delete_user_custom_exercise from anon;
grant execute on function public.delete_user_custom_exercise to authenticated;
