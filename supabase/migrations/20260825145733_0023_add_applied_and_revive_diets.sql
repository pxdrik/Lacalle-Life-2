-- NOTA: esta versão tem um bug de isolamento entre usuários, corrigido em
-- 20260825145801_0024_fix_revive_missing_owner_check_diets.sql — mantida
-- aqui sem edição (append-only). O ON CONFLICT DO UPDATE abaixo revive uma
-- linha tombstoned sem checar se ela pertence ao mesmo usuário que chama:
-- dentro de security definer, RLS não filtra automaticamente.
drop function public.save_diet(uuid, jsonb, bigint, timestamptz);
drop function public.delete_diet(uuid, timestamptz);

create or replace function public.save_diet(
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
    insert into public.diets (id, user_id, payload, client_updated_at)
    values (p_id, v_uid, p_payload, p_client_updated_at)
    on conflict (id) do update
      set payload = excluded.payload,
          client_updated_at = excluded.client_updated_at,
          deleted_at = null
      where public.diets.deleted_at is not null
        and public.diets.user_id = excluded.user_id;
    get diagnostics v_row_count = row_count;
  else
    update public.diets
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.diets.id = p_id
      and public.diets.user_id = v_uid
      and public.diets.server_updated_at = p_expected_server_updated_at;
    get diagnostics v_row_count = row_count;
  end if;

  return query
    select d.server_updated_at, (v_row_count > 0) as applied
    from public.diets d
    where d.id = p_id and d.user_id = v_uid;
end;
$$;

revoke execute on function public.save_diet from public;
revoke execute on function public.save_diet from anon;
grant execute on function public.save_diet to authenticated;

create or replace function public.delete_diet(
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

  update public.diets
  set deleted_at = now()
  where public.diets.id = p_id
    and public.diets.user_id = v_uid
    and public.diets.server_updated_at = p_expected_server_updated_at;
  get diagnostics v_row_count = row_count;

  return query
    select d.server_updated_at, (v_row_count > 0) as applied
    from public.diets d
    where d.id = p_id and d.user_id = v_uid;
end;
$$;

revoke execute on function public.delete_diet from public;
revoke execute on function public.delete_diet from anon;
grant execute on function public.delete_diet to authenticated;
