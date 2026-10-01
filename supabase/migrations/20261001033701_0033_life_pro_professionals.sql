-- Life Pro, Etapa 1 (docs/visao-adm-plano.md): quem é administrador, o pedido
-- de acesso do profissional e o histórico das decisões.
--
-- Regra que atravessa o arquivo: ninguém muda a própria permissão. As três
-- tabelas não aceitam escrita direta do app; o profissional só PEDE (e a
-- função força "em análise"), e só um administrador aprova, recusa ou
-- suspende, por funções que conferem isso no próprio banco. O administrador
-- não se torna administrador pelo app: `app_admins` não tem permissão
-- nenhuma para `anon` e `authenticated`, nem de leitura.

-- ---------------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------------
create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create function public.is_admin() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

-- `anon` também executa: as regras de leitura abaixo chamam esta função, e
-- sem a permissão uma leitura de visitante viraria erro em vez de "nada".
-- Para quem não está logado ela devolve false.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pedido e situação do profissional
-- ---------------------------------------------------------------------------
create table public.professional_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Só nutricionista nesta versão; educador físico entra com as fichas de treino.
  profession text not null check (profession in ('nutritionist')),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  council_region text not null check (council_region ~ '^CRN-([1-9]|1[0-2])$'),
  council_number text not null check (council_number ~ '^[0-9]{1,8}$'),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  -- O motivo vem de uma lista fechada: é o texto que a pessoa lê no Perfil.
  rejection_reason text
    check (rejection_reason in ('council_not_found', 'name_mismatch', 'inactive')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check ((status = 'rejected') = (rejection_reason is not null))
);

alter table public.professional_profiles enable row level security;

create policy "professional_profiles_select_own_or_admin"
  on public.professional_profiles for select
  using (auth.uid() = user_id or public.is_admin());

revoke insert, update, delete on public.professional_profiles from anon, authenticated;

create index professional_profiles_status_idx on public.professional_profiles (status, requested_at);

-- ---------------------------------------------------------------------------
-- Histórico das decisões do administrador
-- ---------------------------------------------------------------------------
-- Sem cascata: apagar uma conta não apaga o registro de que ela foi aprovada
-- ou suspensa. Os ids viram null, e `detail` guarda nome e registro.
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('approve', 'reject', 'suspend', 'reactivate')),
  target_user_id uuid references auth.users(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create policy "admin_audit_log_select_admin"
  on public.admin_audit_log for select
  using (public.is_admin());

revoke insert, update, delete on public.admin_audit_log from anon, authenticated;

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Pedir acesso (o próprio usuário)
-- ---------------------------------------------------------------------------
-- Cria o pedido, ou reenvia depois de uma recusa. Sempre volta para "em
-- análise". Quem já foi aprovado ou suspenso não pede de novo: reenviar não
-- pode virar um jeito de sair de uma suspensão.
create function public.request_professional_access(
  p_profession text,
  p_display_name text,
  p_council_region text,
  p_council_number text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select status into v_status from public.professional_profiles where user_id = v_uid;

  if v_status in ('approved', 'suspended') then
    raise exception 'already reviewed';
  end if;

  insert into public.professional_profiles
    (user_id, profession, display_name, council_region, council_number)
  values
    (v_uid, p_profession, btrim(p_display_name), p_council_region, btrim(p_council_number))
  on conflict (user_id) do update
    set profession = excluded.profession,
        display_name = excluded.display_name,
        council_region = excluded.council_region,
        council_number = excluded.council_number,
        status = 'pending',
        rejection_reason = null,
        requested_at = now(),
        reviewed_at = null,
        reviewed_by = null,
        updated_at = now();

  return 'pending';
end;
$$;

revoke execute on function public.request_professional_access(text, text, text, text) from public;
revoke execute on function public.request_professional_access(text, text, text, text) from anon;
grant execute on function public.request_professional_access(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Decisões do administrador
-- ---------------------------------------------------------------------------
create function public.admin_review_professional(
  p_user_id uuid,
  p_decision text,
  p_reason text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_row public.professional_profiles;
begin
  if not public.is_admin() then
    raise exception 'not admin';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid decision';
  end if;
  if p_decision = 'reject' and p_reason is null then
    raise exception 'reason required';
  end if;

  select * into v_row from public.professional_profiles where user_id = p_user_id for update;
  if not found then
    raise exception 'not found';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'not pending';
  end if;

  update public.professional_profiles
    set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
        rejection_reason = case when p_decision = 'reject' then p_reason else null end,
        reviewed_at = now(),
        reviewed_by = v_admin,
        updated_at = now()
    where user_id = p_user_id;

  insert into public.admin_audit_log (actor_id, action, target_user_id, detail)
  values (
    v_admin,
    p_decision,
    p_user_id,
    jsonb_build_object(
      'display_name', v_row.display_name,
      'council', v_row.council_region || ' ' || v_row.council_number,
      'reason', p_reason
    )
  );

  return case when p_decision = 'approve' then 'approved' else 'rejected' end;
end;
$$;

revoke execute on function public.admin_review_professional(uuid, text, text) from public;
revoke execute on function public.admin_review_professional(uuid, text, text) from anon;
grant execute on function public.admin_review_professional(uuid, text, text) to authenticated;

-- Suspender corta o acesso ao Life Pro (e, nas próximas etapas, aos dados dos
-- pacientes) sem apagar nada; reativar devolve como estava.
create function public.admin_set_professional_suspended(
  p_user_id uuid,
  p_suspended boolean
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_row public.professional_profiles;
  v_next text := case when p_suspended then 'suspended' else 'approved' end;
begin
  if not public.is_admin() then
    raise exception 'not admin';
  end if;

  select * into v_row from public.professional_profiles where user_id = p_user_id for update;
  if not found then
    raise exception 'not found';
  end if;
  -- Entre parênteses: dentro de um IF, o plpgsql corta a condição no primeiro
  -- THEN que encontra, e o do CASE viria antes do do IF.
  if v_row.status <> (case when p_suspended then 'approved' else 'suspended' end) then
    raise exception 'invalid transition';
  end if;

  update public.professional_profiles
    set status = v_next, updated_at = now()
    where user_id = p_user_id;

  insert into public.admin_audit_log (actor_id, action, target_user_id, detail)
  values (
    v_admin,
    case when p_suspended then 'suspend' else 'reactivate' end,
    p_user_id,
    jsonb_build_object(
      'display_name', v_row.display_name,
      'council', v_row.council_region || ' ' || v_row.council_number
    )
  );

  return v_next;
end;
$$;

revoke execute on function public.admin_set_professional_suspended(uuid, boolean) from public;
revoke execute on function public.admin_set_professional_suspended(uuid, boolean) from anon;
grant execute on function public.admin_set_professional_suspended(uuid, boolean) to authenticated;

-- A lista da tela de administração, com o e-mail da conta (que fica em
-- `auth.users`, fora do alcance do app). Só para administrador.
create function public.admin_list_professionals()
returns table (
  user_id uuid,
  email text,
  profession text,
  display_name text,
  council_region text,
  council_number text,
  status text,
  rejection_reason text,
  requested_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not admin';
  end if;

  return query
    select p.user_id, u.email::text, p.profession, p.display_name, p.council_region,
           p.council_number, p.status, p.rejection_reason, p.requested_at, p.reviewed_at
    from public.professional_profiles p
    join auth.users u on u.id = p.user_id
    order by p.requested_at;
end;
$$;

revoke execute on function public.admin_list_professionals() from public;
revoke execute on function public.admin_list_professionals() from anon;
grant execute on function public.admin_list_professionals() to authenticated;

-- ---------------------------------------------------------------------------
-- O administrador do app (decisão do Pedro, 01/10/2026)
-- ---------------------------------------------------------------------------
-- Se a conta ainda não existir quando esta migração rodar, nada acontece, e o
-- mesmo insert roda depois que ela for criada.
insert into public.app_admins (user_id)
select id from auth.users where lower(email) = 'lacallepm@gmail.com'
on conflict (user_id) do nothing;
