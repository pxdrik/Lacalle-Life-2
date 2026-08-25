-- NOTA: mesmo bug de ambiguidade de 0005 (ver comentário lá). Corrigido em
-- 20260825144538_0020_fix_ambiguous_server_updated_at_profiles.sql.
create or replace function public.save_profile(
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
    insert into public.profiles (user_id, payload, client_updated_at)
    values (v_uid, p_payload, p_client_updated_at)
    on conflict (user_id) do nothing;
  else
    update public.profiles
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where user_id = v_uid
      and server_updated_at = p_expected_server_updated_at;
  end if;

  return query
    select p.server_updated_at from public.profiles p
    where p.user_id = v_uid;
end;
$$;

revoke execute on function public.save_profile from public;
revoke execute on function public.save_profile from anon;
grant execute on function public.save_profile to authenticated;

-- Corresponde a "Apagar dados" local: zera o perfil, não a conta.
create or replace function public.delete_profile(
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

  update public.profiles
  set deleted_at = now()
  where user_id = v_uid
    and server_updated_at = p_expected_server_updated_at;

  return query
    select p.server_updated_at from public.profiles p
    where p.user_id = v_uid;
end;
$$;

revoke execute on function public.delete_profile from public;
revoke execute on function public.delete_profile from anon;
grant execute on function public.delete_profile to authenticated;
