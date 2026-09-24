-- Água: um registro por dia, mesma convenção de body_entries (id local já é
-- o dia, primary key (user_id, day)). Escrita direto na forma final e
-- correta de save_body_entry/delete_body_entry (pós migrations 0018 e 0029)
-- em vez de repetir as três gerações de bugs que aquela tabela teve
-- (referência ambígua a server_updated_at, applied/revive ausente,
-- checagem de dono no revive) — o "porquê" de cada detalhe abaixo está
-- documentado lá, não repetido aqui.

create table public.water_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  ml numeric not null default 0,
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.water_entries enable row level security;
create policy "water_entries_select_own" on public.water_entries for select using (auth.uid() = user_id);
revoke insert, update on public.water_entries from authenticated;
revoke insert, update on public.water_entries from anon;
create trigger water_entries_set_server_updated_at before insert or update on public.water_entries for each row execute function public.set_server_updated_at();

create or replace function public.save_water_entry(
  p_day date,
  p_ml numeric,
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
    insert into public.water_entries
      (user_id, day, ml, client_updated_at)
    values
      (v_uid, p_day, p_ml, p_client_updated_at)
    on conflict (user_id, day) do update
      set ml = excluded.ml,
          client_updated_at = excluded.client_updated_at,
          deleted_at = null
      where public.water_entries.deleted_at is not null;
    get diagnostics v_row_count = row_count;
  else
    update public.water_entries
    set ml = p_ml,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.water_entries.user_id = v_uid
      and public.water_entries.day = p_day
      and public.water_entries.server_updated_at = p_expected_server_updated_at;
    get diagnostics v_row_count = row_count;
  end if;

  return query
    select w.server_updated_at, (v_row_count > 0) as applied
    from public.water_entries w
    where w.user_id = v_uid and w.day = p_day;
end;
$$;

revoke execute on function public.save_water_entry from public;
revoke execute on function public.save_water_entry from anon;
grant execute on function public.save_water_entry to authenticated;

create or replace function public.delete_water_entry(
  p_day date,
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

  update public.water_entries
  set deleted_at = now()
  where public.water_entries.user_id = v_uid
    and public.water_entries.day = p_day
    and public.water_entries.server_updated_at = p_expected_server_updated_at;
  get diagnostics v_row_count = row_count;

  return query
    select w.server_updated_at, (v_row_count > 0) as applied
    from public.water_entries w
    where w.user_id = v_uid and w.day = p_day;
end;
$$;

revoke execute on function public.delete_water_entry from public;
revoke execute on function public.delete_water_entry from anon;
grant execute on function public.delete_water_entry to authenticated;
