-- Achado testando de verdade: INSERT ... ON CONFLICT DO NOTHING nunca
-- reaplica sobre uma linha existente, mesmo tombstoned (deleted_at
-- preenchido) — "apagar o perfil e preencher de novo" nunca aplicava,
-- applied ficava false pra sempre depois do primeiro apagamento. Trocado
-- para DO UPDATE condicionado a deleted_at is not null: revive se estava
-- apagada, mas nunca sobrescreve silenciosamente uma linha viva que por
-- algum motivo já existisse (esse caso é conflito de verdade, não recriação).
drop function public.save_profile(jsonb, bigint, timestamptz);

create or replace function public.save_profile(
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
    insert into public.profiles (user_id, payload, client_updated_at)
    values (v_uid, p_payload, p_client_updated_at)
    on conflict (user_id) do update
      set payload = excluded.payload,
          client_updated_at = excluded.client_updated_at,
          deleted_at = null
      where public.profiles.deleted_at is not null;
    get diagnostics v_row_count = row_count;
  else
    update public.profiles
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.profiles.user_id = v_uid
      and public.profiles.server_updated_at = p_expected_server_updated_at;
    get diagnostics v_row_count = row_count;
  end if;

  return query
    select p.server_updated_at, (v_row_count > 0) as applied
    from public.profiles p
    where p.user_id = v_uid;
end;
$$;

revoke execute on function public.save_profile from public;
revoke execute on function public.save_profile from anon;
grant execute on function public.save_profile to authenticated;
