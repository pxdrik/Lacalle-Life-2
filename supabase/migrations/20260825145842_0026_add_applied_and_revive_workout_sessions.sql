drop function public.save_workout_session(uuid, uuid, text, bigint, bigint, jsonb, bigint, timestamptz);
drop function public.delete_workout_session(uuid, timestamptz);

create or replace function public.save_workout_session(
  p_id uuid,
  p_routine_id uuid,
  p_name text,
  p_started_at bigint,
  p_finished_at bigint,
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

  if p_finished_at is null then
    raise exception 'workout_sessions only sync once finished';
  end if;

  if p_expected_server_updated_at is null then
    insert into public.workout_sessions
      (id, user_id, routine_id, name, started_at, finished_at, payload, client_updated_at)
    values
      (p_id, v_uid, p_routine_id, p_name, p_started_at, p_finished_at, p_payload, p_client_updated_at)
    on conflict (id) do update
      set routine_id = excluded.routine_id,
          name = excluded.name,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at,
          payload = excluded.payload,
          client_updated_at = excluded.client_updated_at,
          deleted_at = null
      where public.workout_sessions.deleted_at is not null
        and public.workout_sessions.user_id = v_uid;
    get diagnostics v_row_count = row_count;
  else
    update public.workout_sessions
    set routine_id = p_routine_id,
        name = p_name,
        started_at = p_started_at,
        finished_at = p_finished_at,
        payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.workout_sessions.id = p_id
      and public.workout_sessions.user_id = v_uid
      and public.workout_sessions.server_updated_at = p_expected_server_updated_at;
    get diagnostics v_row_count = row_count;
  end if;

  return query
    select s.server_updated_at, (v_row_count > 0) as applied
    from public.workout_sessions s
    where s.id = p_id and s.user_id = v_uid;
end;
$$;

revoke execute on function public.save_workout_session from public;
revoke execute on function public.save_workout_session from anon;
grant execute on function public.save_workout_session to authenticated;

create or replace function public.delete_workout_session(
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

  update public.workout_sessions
  set deleted_at = now()
  where public.workout_sessions.id = p_id
    and public.workout_sessions.user_id = v_uid
    and public.workout_sessions.server_updated_at = p_expected_server_updated_at;
  get diagnostics v_row_count = row_count;

  return query
    select s.server_updated_at, (v_row_count > 0) as applied
    from public.workout_sessions s
    where s.id = p_id and s.user_id = v_uid;
end;
$$;

revoke execute on function public.delete_workout_session from public;
revoke execute on function public.delete_workout_session from anon;
grant execute on function public.delete_workout_session to authenticated;
