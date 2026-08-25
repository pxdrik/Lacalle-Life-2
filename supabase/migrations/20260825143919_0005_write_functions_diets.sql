-- NOTA: esta versão tem um bug real, corrigido em
-- 20260825144351_0013_fix_ambiguous_server_updated_at_diets.sql — mantida
-- aqui sem edição (append-only, mesma regra de composition/migrations.ts).
-- O UPDATE abaixo referencia `server_updated_at` sem qualificar com o nome
-- da tabela; como `returns table (server_updated_at timestamptz)` cria uma
-- variável de saída com esse mesmo nome, Postgres não consegue decidir se
-- é a variável ou a coluna — erro 42702 "column reference is ambiguous"
-- em todo caminho de UPDATE (ou seja, todo conflito de verdade). Só
-- apareceu atacando a função contra o banco real, não na leitura do SQL.
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
    where id = p_id
      and user_id = v_uid
      and server_updated_at = p_expected_server_updated_at;
  end if;

  return query
    select d.server_updated_at from public.diets d
    where d.id = p_id and d.user_id = v_uid;
end;
$$;

revoke execute on function public.save_diet from public;
revoke execute on function public.save_diet from anon;
grant execute on function public.save_diet to authenticated;

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
  where id = p_id
    and user_id = v_uid
    and server_updated_at = p_expected_server_updated_at;

  return query
    select d.server_updated_at from public.diets d
    where d.id = p_id and d.user_id = v_uid;
end;
$$;

revoke execute on function public.delete_diet from public;
revoke execute on function public.delete_diet from anon;
grant execute on function public.delete_diet to authenticated;
