create or replace function public.save_food_log(
  p_day date,
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
    insert into public.food_logs (user_id, day, payload, client_updated_at)
    values (v_uid, p_day, p_payload, p_client_updated_at)
    on conflict (user_id, day) do nothing;
  else
    update public.food_logs
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.food_logs.user_id = v_uid
      and public.food_logs.day = p_day
      and public.food_logs.server_updated_at = p_expected_server_updated_at;
  end if;

  return query
    select l.server_updated_at from public.food_logs l
    where l.user_id = v_uid and l.day = p_day;
end;
$$;

create or replace function public.delete_food_log(
  p_day date,
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

  update public.food_logs
  set deleted_at = now()
  where public.food_logs.user_id = v_uid
    and public.food_logs.day = p_day
    and public.food_logs.server_updated_at = p_expected_server_updated_at;

  return query
    select l.server_updated_at from public.food_logs l
    where l.user_id = v_uid and l.day = p_day;
end;
$$;
