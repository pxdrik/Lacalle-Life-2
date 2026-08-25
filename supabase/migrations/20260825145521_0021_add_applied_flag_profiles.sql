-- Achado desenhando o motor de sync (não no schema em si): server_updated_at
-- sozinho não deixa o cliente distinguir "minha escrita aconteceu" de
-- "houve conflito" — nos dois casos o valor devolvido é diferente do que o
-- cliente esperava. `applied` fecha essa ambiguidade: true só quando a
-- linha realmente mudou por causa desta chamada (GET DIAGNOSTICS ROW_COUNT).
drop function public.save_profile(jsonb, bigint, timestamptz);
drop function public.delete_profile(timestamptz);

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
    on conflict (user_id) do nothing;
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

create or replace function public.delete_profile(
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

  update public.profiles
  set deleted_at = now()
  where public.profiles.user_id = v_uid
    and public.profiles.server_updated_at = p_expected_server_updated_at;
  get diagnostics v_row_count = row_count;

  return query
    select p.server_updated_at, (v_row_count > 0) as applied
    from public.profiles p
    where p.user_id = v_uid;
end;
$$;

revoke execute on function public.delete_profile from public;
revoke execute on function public.delete_profile from anon;
grant execute on function public.delete_profile to authenticated;
