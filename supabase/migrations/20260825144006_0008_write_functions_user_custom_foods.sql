-- NOTA: mesmo bug de ambiguidade de 0005 (ver comentário lá). Corrigido em
-- 20260825144450_0016_fix_ambiguous_server_updated_at_user_custom_foods.sql.
create or replace function public.save_user_custom_food(
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
    insert into public.user_custom_foods (id, user_id, payload, client_updated_at)
    values (p_id, v_uid, p_payload, p_client_updated_at)
    on conflict (id) do nothing;
  else
    update public.user_custom_foods
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where id = p_id
      and user_id = v_uid
      and server_updated_at = p_expected_server_updated_at;
  end if;

  return query
    select f.server_updated_at from public.user_custom_foods f
    where f.id = p_id and f.user_id = v_uid;
end;
$$;

revoke execute on function public.save_user_custom_food from public;
revoke execute on function public.save_user_custom_food from anon;
grant execute on function public.save_user_custom_food to authenticated;

create or replace function public.delete_user_custom_food(
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

  update public.user_custom_foods
  set deleted_at = now()
  where id = p_id
    and user_id = v_uid
    and server_updated_at = p_expected_server_updated_at;

  return query
    select f.server_updated_at from public.user_custom_foods f
    where f.id = p_id and f.user_id = v_uid;
end;
$$;

revoke execute on function public.delete_user_custom_food from public;
revoke execute on function public.delete_user_custom_food from anon;
grant execute on function public.delete_user_custom_food to authenticated;
