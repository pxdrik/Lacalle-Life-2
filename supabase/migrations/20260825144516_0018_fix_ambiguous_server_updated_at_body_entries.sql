create or replace function public.save_body_entry(
  p_day date,
  p_weight_kg numeric,
  p_body_fat_percent numeric,
  p_measurements jsonb,
  p_notes text,
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
    insert into public.body_entries
      (user_id, day, weight_kg, body_fat_percent, measurements, notes, client_updated_at)
    values
      (v_uid, p_day, p_weight_kg, p_body_fat_percent, p_measurements, p_notes, p_client_updated_at)
    on conflict (user_id, day) do nothing;
  else
    update public.body_entries
    set weight_kg = p_weight_kg,
        body_fat_percent = p_body_fat_percent,
        measurements = p_measurements,
        notes = p_notes,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.body_entries.user_id = v_uid
      and public.body_entries.day = p_day
      and public.body_entries.server_updated_at = p_expected_server_updated_at;
  end if;

  return query
    select b.server_updated_at from public.body_entries b
    where b.user_id = v_uid and b.day = p_day;
end;
$$;

create or replace function public.delete_body_entry(
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

  update public.body_entries
  set deleted_at = now()
  where public.body_entries.user_id = v_uid
    and public.body_entries.day = p_day
    and public.body_entries.server_updated_at = p_expected_server_updated_at;

  return query
    select b.server_updated_at from public.body_entries b
    where b.user_id = v_uid and b.day = p_day;
end;
$$;
