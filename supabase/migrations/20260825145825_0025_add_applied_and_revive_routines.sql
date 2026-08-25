-- Mesmo padrão de 0022+0024 (applied boolean, revive de tombstone com
-- checagem de dono), já correto de saída — routines nunca passou pela
-- versão insegura que diets passou em 0023.
drop function public.save_routine(uuid, jsonb, bigint, timestamptz);
drop function public.delete_routine(uuid, timestamptz);

create or replace function public.save_routine(
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
    insert into public.routines (id, user_id, payload, client_updated_at)
    values (p_id, v_uid, p_payload, p_client_updated_at)
    on conflict (id) do update
      set payload = excluded.payload,
          client_updated_at = excluded.client_updated_at,
          deleted_at = null
      where public.routines.deleted_at is not null
        and public.routines.user_id = v_uid;
    get diagnostics v_row_count = row_count;
  else
    update public.routines
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.routines.id = p_id
      and public.routines.user_id = v_uid
      and public.routines.server_updated_at = p_expected_server_updated_at;
    get diagnostics v_row_count = row_count;
  end if;

  return query
    select r.server_updated_at, (v_row_count > 0) as applied
    from public.routines r
    where r.id = p_id and r.user_id = v_uid;
end;
$$;

revoke execute on function public.save_routine from public;
revoke execute on function public.save_routine from anon;
grant execute on function public.save_routine to authenticated;

create or replace function public.delete_routine(
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

  update public.routines
  set deleted_at = now()
  where public.routines.id = p_id
    and public.routines.user_id = v_uid
    and public.routines.server_updated_at = p_expected_server_updated_at;
  get diagnostics v_row_count = row_count;

  return query
    select r.server_updated_at, (v_row_count > 0) as applied
    from public.routines r
    where r.id = p_id and r.user_id = v_uid;
end;
$$;

revoke execute on function public.delete_routine from public;
revoke execute on function public.delete_routine from anon;
grant execute on function public.delete_routine to authenticated;
