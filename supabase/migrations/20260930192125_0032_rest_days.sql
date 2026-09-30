-- Dia de descanso (roadmap 7.5, 30/09/2026): um registro por dia marcado,
-- e existir é a marca, desmarcar é soft delete. Cópia de 0031_water_entries
-- sem a coluna ml: mesma chave (user_id, day), mesmo RLS só de leitura,
-- mesmas RPCs com (server_updated_at, applied) e revive de tombstone.

create table public.rest_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.rest_days enable row level security;
create policy "rest_days_select_own" on public.rest_days for select using (auth.uid() = user_id);
revoke insert, update on public.rest_days from authenticated;
revoke insert, update on public.rest_days from anon;
create trigger rest_days_set_server_updated_at before insert or update on public.rest_days for each row execute function public.set_server_updated_at();

create or replace function public.save_rest_day(
  p_day date,
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
    insert into public.rest_days
      (user_id, day, client_updated_at)
    values
      (v_uid, p_day, p_client_updated_at)
    on conflict (user_id, day) do update
      set client_updated_at = excluded.client_updated_at,
          deleted_at = null
      where public.rest_days.deleted_at is not null;
    get diagnostics v_row_count = row_count;
  else
    update public.rest_days
    set client_updated_at = p_client_updated_at,
        deleted_at = null
    where public.rest_days.user_id = v_uid
      and public.rest_days.day = p_day
      and public.rest_days.server_updated_at = p_expected_server_updated_at;
    get diagnostics v_row_count = row_count;
  end if;

  return query
    select r.server_updated_at, (v_row_count > 0) as applied
    from public.rest_days r
    where r.user_id = v_uid and r.day = p_day;
end;
$$;

revoke execute on function public.save_rest_day from public;
revoke execute on function public.save_rest_day from anon;
grant execute on function public.save_rest_day to authenticated;

create or replace function public.delete_rest_day(
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

  update public.rest_days
  set deleted_at = now()
  where public.rest_days.user_id = v_uid
    and public.rest_days.day = p_day
    and public.rest_days.server_updated_at = p_expected_server_updated_at;
  get diagnostics v_row_count = row_count;

  return query
    select r.server_updated_at, (v_row_count > 0) as applied
    from public.rest_days r
    where r.user_id = v_uid and r.day = p_day;
end;
$$;

revoke execute on function public.delete_rest_day from public;
revoke execute on function public.delete_rest_day from anon;
grant execute on function public.delete_rest_day to authenticated;
