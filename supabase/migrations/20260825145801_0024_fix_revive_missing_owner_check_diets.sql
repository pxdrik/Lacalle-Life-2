-- Achado de segurança real: dentro de security definer, RLS não filtra
-- automaticamente. O ON CONFLICT DO UPDATE de 0023 revivia uma linha
-- tombstoned sem checar se ela pertence ao MESMO usuário que está
-- chamando — um id colidindo (improvável, mas não impossível) deixaria um
-- usuário reviver/sobrescrever o registro de outro, mantendo o user_id
-- original mas com o payload do atacante. Corrigido: o WHERE agora exige
-- deleted_at is not null E user_id = v_uid (nunca excluded.user_id, que é
-- sempre o do chamador e não prova nada sobre a linha existente).
--
-- Só as tabelas com PK = id (UUID) sozinho precisam desta checagem extra
-- (diets, routines, workout_sessions, user_custom_foods,
-- user_custom_exercises). profiles/body_entries/food_logs já têm user_id
-- na própria chave de conflito, então o ON CONFLICT já garante que só
-- colide com uma linha do mesmo dono.
drop function public.save_diet(uuid, jsonb, bigint, timestamptz);

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
        and public.diets.user_id = v_uid;
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
