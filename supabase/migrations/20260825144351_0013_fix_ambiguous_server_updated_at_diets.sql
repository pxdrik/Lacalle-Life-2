-- Achado atacando as RPCs de verdade contra o banco (não no design): a
-- variável de saída de `returns table (server_updated_at timestamptz)`
-- colide com a coluna real da tabela dentro do WHERE, sem qualificação.
-- Postgres erro 42702. Corrigido qualificando com o nome da tabela.
create or replace function public.save_diet(
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
    insert into public.diets (id, user_id, payload, client_updated_at)
    values (p_id, v_uid, p_payload, p_client_updated_at)
    on conflict (id) do nothing;
  else
    update public.diets
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.diets.id = p_id
      and public.diets.user_id = v_uid
      and public.diets.server_updated_at = p_expected_server_updated_at;
  end if;

  return query
    select d.server_updated_at from public.diets d
    where d.id = p_id and d.user_id = v_uid;
end;
$$;

create or replace function public.delete_diet(
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

  update public.diets
  set deleted_at = now()
  where public.diets.id = p_id
    and public.diets.user_id = v_uid
    and public.diets.server_updated_at = p_expected_server_updated_at;

  return query
    select d.server_updated_at from public.diets d
    where d.id = p_id and d.user_id = v_uid;
end;
$$;
