-- Carimba server_updated_at no INSERT/UPDATE de toda tabela sincronizável.
-- É o único árbitro de ordem entre dispositivos (docs/arquitetura-sincronizacao.md §8.5,
-- §18.1, §19.3) — nunca aceito como valor vindo do cliente.
create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;
