-- Life Pro, Etapa 4 (docs/visao-adm-plano.md): o vínculo entre profissional e
-- paciente, e o convite por link que o cria.
--
-- O que estas tabelas guardam é a RELAÇÃO, nunca o conteúdo: diário, peso e
-- planos continuam nas tabelas do paciente, com a regra "só o dono" intacta.
-- A leitura do profissional (Etapa 6) vai por funções que conferem o vínculo
-- ativo e o que foi liberado aqui.
--
-- Nada aqui aceita escrita direta do app. O convite nasce de uma função que
-- só profissional aprovado chama; o código volta uma vez só e o banco guarda
-- apenas o hash dele; o vínculo nasce quando o paciente aceita; o que ele
-- libera, só ele muda; encerrar, qualquer um dos dois.

-- ---------------------------------------------------------------------------
-- Vínculos
-- ---------------------------------------------------------------------------
create table public.care_links (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  -- O nome que o profissional deu ao convidar: o app não tem nome de pessoa
  -- (o perfil guarda metas, não identidade), e é assim que ele a reconhece.
  patient_label text not null check (char_length(btrim(patient_label)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'ended')),
  share_diary boolean not null default false,
  share_body boolean not null default false,
  share_profile boolean not null default false,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  check (professional_id <> patient_id),
  check ((status = 'ended') = (ended_at is not null))
);

-- Um vínculo ativo por par; encerrado, um novo convite pode criar outro.
create unique index care_links_one_active_idx
  on public.care_links (professional_id, patient_id) where status = 'active';
create index care_links_patient_idx on public.care_links (patient_id, status);
create index care_links_professional_idx on public.care_links (professional_id, status);

alter table public.care_links enable row level security;

create policy "care_links_select_party_or_admin"
  on public.care_links for select
  using (auth.uid() = professional_id or auth.uid() = patient_id or public.is_admin());

revoke insert, update, delete on public.care_links from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------------
create table public.care_invites (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_label text not null check (char_length(btrim(patient_label)) between 1 and 120),
  -- sha256 do código. O código em si só existe na resposta de create_invite.
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  link_id uuid references public.care_links(id) on delete set null
);

create index care_invites_professional_idx on public.care_invites (professional_id, status);

alter table public.care_invites enable row level security;

create policy "care_invites_select_own_or_admin"
  on public.care_invites for select
  using (auth.uid() = professional_id or public.is_admin());

revoke insert, update, delete on public.care_invites from anon, authenticated;

create function public.is_approved_professional(p_user_id uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.professional_profiles
    where user_id = p_user_id and status = 'approved'
  );
$$;

revoke execute on function public.is_approved_professional(uuid) from public;
revoke execute on function public.is_approved_professional(uuid) from anon;
revoke execute on function public.is_approved_professional(uuid) from authenticated;

create function public.invite_token_hash(p_token text) returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

revoke execute on function public.invite_token_hash(text) from public;
revoke execute on function public.invite_token_hash(text) from anon;
revoke execute on function public.invite_token_hash(text) from authenticated;

-- Profissional aprovado gera um convite. O código (32 caracteres, 122 bits
-- aleatórios de um uuid v4) volta só aqui; vale 7 dias e uma vez só.
create function public.create_invite(p_patient_label text)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_approved_professional(v_uid) then
    raise exception 'not an approved professional';
  end if;

  insert into public.care_invites (professional_id, patient_label, token_hash, expires_at)
  values (v_uid, btrim(p_patient_label), public.invite_token_hash(v_token), v_expires)
  returning id into v_id;

  return query select v_id, v_token, v_expires;
end;
$$;

revoke execute on function public.create_invite(text) from public;
revoke execute on function public.create_invite(text) from anon;
grant execute on function public.create_invite(text) to authenticated;

create function public.cancel_invite(p_invite_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.care_invites
    set status = 'cancelled'
    where id = p_invite_id and professional_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'not found';
  end if;
end;
$$;

revoke execute on function public.cancel_invite(uuid) from public;
revoke execute on function public.cancel_invite(uuid) from anon;
grant execute on function public.cancel_invite(uuid) to authenticated;

-- O que a página do convite mostra antes de aceitar. Quem tem o código vê o
-- nome e o registro de quem convidou, e nada mais; visitante sem conta
-- também, para a página dizer "entre para aceitar". Código que não existe,
-- usado, cancelado ou vencido volta como situação, sem dizer qual código
-- existe.
create function public.get_invite(p_token text)
returns table (state text, professional_name text, council text, is_own boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite public.care_invites;
  v_pro public.professional_profiles;
begin
  select * into v_invite from public.care_invites where token_hash = public.invite_token_hash(p_token);
  if not found then
    return query select 'invalid'::text, null::text, null::text, false;
    return;
  end if;
  select * into v_pro from public.professional_profiles where user_id = v_invite.professional_id;

  return query select
    case
      when v_invite.status = 'accepted' then 'used'
      when v_invite.status = 'cancelled' then 'invalid'
      when v_invite.expires_at < now() then 'expired'
      when v_pro.status is distinct from 'approved' then 'invalid'
      else 'valid'
    end,
    v_pro.display_name,
    v_pro.council_region || ' ' || v_pro.council_number,
    coalesce(auth.uid() = v_invite.professional_id, false);
end;
$$;

revoke execute on function public.get_invite(text) from public;
grant execute on function public.get_invite(text) to anon, authenticated;

-- O paciente aceita e escolhe o que libera. Uso único: o mesmo código não
-- cria um segundo vínculo. Se já houver vínculo ativo com a mesma
-- profissional, o aceite só atualiza o que é liberado.
create function public.accept_invite(
  p_token text,
  p_share_diary boolean,
  p_share_body boolean,
  p_share_profile boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.care_invites;
  v_link uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_invite from public.care_invites
    where token_hash = public.invite_token_hash(p_token)
    for update;
  if not found or v_invite.status <> 'pending' or v_invite.expires_at < now()
     or not public.is_approved_professional(v_invite.professional_id) then
    raise exception 'invalid invite';
  end if;
  if v_invite.professional_id = v_uid then
    raise exception 'own invite';
  end if;

  select id into v_link from public.care_links
    where professional_id = v_invite.professional_id and patient_id = v_uid and status = 'active';

  if v_link is null then
    insert into public.care_links
      (professional_id, patient_id, patient_label, share_diary, share_body, share_profile)
    values
      (v_invite.professional_id, v_uid, v_invite.patient_label, p_share_diary, p_share_body, p_share_profile)
    returning id into v_link;
  else
    update public.care_links
      set share_diary = p_share_diary, share_body = p_share_body, share_profile = p_share_profile
      where id = v_link;
  end if;

  update public.care_invites
    set status = 'accepted', accepted_at = now(), link_id = v_link
    where id = v_invite.id;

  return v_link;
end;
$$;

revoke execute on function public.accept_invite(text, boolean, boolean, boolean) from public;
revoke execute on function public.accept_invite(text, boolean, boolean, boolean) from anon;
grant execute on function public.accept_invite(text, boolean, boolean, boolean) to authenticated;

-- Só o paciente muda o que libera, e só num vínculo ativo.
create function public.update_link_sharing(
  p_link_id uuid,
  p_share_diary boolean,
  p_share_body boolean,
  p_share_profile boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.care_links
    set share_diary = p_share_diary, share_body = p_share_body, share_profile = p_share_profile
    where id = p_link_id and patient_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'not found';
  end if;
end;
$$;

revoke execute on function public.update_link_sharing(uuid, boolean, boolean, boolean) from public;
revoke execute on function public.update_link_sharing(uuid, boolean, boolean, boolean) from anon;
grant execute on function public.update_link_sharing(uuid, boolean, boolean, boolean) to authenticated;

-- Qualquer um dos dois encerra. Nada é apagado: o vínculo fica, encerrado.
create function public.end_link(p_link_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.care_links
    set status = 'ended', ended_at = now(), ended_by = auth.uid()
    where id = p_link_id and status = 'active'
      and (patient_id = auth.uid() or professional_id = auth.uid());
  if not found then
    raise exception 'not found';
  end if;
end;
$$;

revoke execute on function public.end_link(uuid) from public;
revoke execute on function public.end_link(uuid) from anon;
grant execute on function public.end_link(uuid) to authenticated;

-- O paciente vê quem o acompanha. O perfil profissional não é legível pelo
-- paciente (0033), então o nome e o registro vêm daqui, só dos vínculos dele.
create function public.my_care_links()
returns table (
  link_id uuid,
  professional_name text,
  council text,
  status text,
  share_diary boolean,
  share_body boolean,
  share_profile boolean,
  created_at timestamptz,
  ended_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return query
    select l.id, p.display_name, p.council_region || ' ' || p.council_number, l.status,
           l.share_diary, l.share_body, l.share_profile, l.created_at, l.ended_at
    from public.care_links l
    join public.professional_profiles p on p.user_id = l.professional_id
    where l.patient_id = auth.uid()
    order by l.created_at desc;
end;
$$;

revoke execute on function public.my_care_links() from public;
revoke execute on function public.my_care_links() from anon;
grant execute on function public.my_care_links() to authenticated;
