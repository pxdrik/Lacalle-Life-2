-- Life Pro, Etapa 8a (docs/visao-adm-plano.md): um perfil profissional só,
-- "treinador", que monta dieta e treino; o pedido guarda os dois registros
-- (decisão do Pedro, 01/10/2026: "pode ser que o treinador tenha os 2").
--
-- - A profissão passa de `nutritionist` para `trainer`. Quem já pediu ou foi
--   aprovado vira treinador com o CRN que já tem, sem pedir de novo.
-- - CRN continua nas colunas de antes (`council_region`, `council_number`),
--   agora opcional. CREF ganha duas colunas. Pelo menos um dos dois.
-- - Nada é apagado. Qualquer registro aprovado libera dieta e treino (decisão
--   do Pedro); os dois ficam guardados para, se a revisão jurídica pedir,
--   cada conselho liberar só a parte dele.

alter table public.professional_profiles
  drop constraint professional_profiles_profession_check;

update public.professional_profiles set profession = 'trainer';

alter table public.professional_profiles
  alter column profession set default 'trainer',
  add constraint professional_profiles_profession_check check (profession in ('trainer')),
  alter column council_region drop not null,
  alter column council_number drop not null,
  -- CREF: número de 6 dígitos com a letra da categoria (G, graduado; P,
  -- provisionado), e a UF da região, como aparece na carteira: 012345-G/SP.
  add column cref_number text check (cref_number ~ '^[0-9]{6}-[GP]$'),
  add column cref_region text check (cref_region ~ '^[A-Z]{2}$'),
  add constraint professional_profiles_crn_pair check ((council_region is null) = (council_number is null)),
  add constraint professional_profiles_cref_pair check ((cref_number is null) = (cref_region is null)),
  add constraint professional_profiles_some_council check (council_number is not null or cref_number is not null);

-- Como o registro aparece no histórico e na tela de administração.
create function public.professional_councils(p public.professional_profiles) returns text
language sql
immutable
set search_path = public
as $$
  select concat_ws(
    ' · ',
    case when p.council_number is not null then p.council_region || ' ' || p.council_number end,
    case when p.cref_number is not null then 'CREF ' || p.cref_number || '/' || p.cref_region end
  );
$$;

revoke execute on function public.professional_councils(public.professional_profiles) from public;
revoke execute on function public.professional_councils(public.professional_profiles) from anon;
revoke execute on function public.professional_councils(public.professional_profiles) from authenticated;

-- O pedido leva os dois registros. A assinatura muda (sai a profissão, que é
-- uma só), então a função antiga sai: nenhum app publicado a chama.
drop function public.request_professional_access(text, text, text, text);

create function public.request_professional_access(
  p_display_name text,
  p_crn_region text,
  p_crn_number text,
  p_cref_number text,
  p_cref_region text
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
    (user_id, profession, display_name, council_region, council_number, cref_number, cref_region)
  values
    (v_uid, 'trainer', btrim(p_display_name), p_crn_region, nullif(btrim(p_crn_number), ''),
     nullif(upper(btrim(p_cref_number)), ''), p_cref_region)
  on conflict (user_id) do update
    set profession = excluded.profession,
        display_name = excluded.display_name,
        council_region = excluded.council_region,
        council_number = excluded.council_number,
        cref_number = excluded.cref_number,
        cref_region = excluded.cref_region,
        status = 'pending',
        rejection_reason = null,
        requested_at = now(),
        reviewed_at = null,
        reviewed_by = null,
        updated_at = now();

  return 'pending';
end;
$$;

revoke execute on function public.request_professional_access(text, text, text, text, text) from public;
revoke execute on function public.request_professional_access(text, text, text, text, text) from anon;
grant execute on function public.request_professional_access(text, text, text, text, text) to authenticated;

-- O histórico guarda os dois registros.
create or replace function public.admin_review_professional(
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
      'council', public.professional_councils(v_row),
      'reason', p_reason
    )
  );

  return case when p_decision = 'approve' then 'approved' else 'rejected' end;
end;
$$;

create or replace function public.admin_set_professional_suspended(
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
      'council', public.professional_councils(v_row)
    )
  );

  return v_next;
end;
$$;

-- A lista da administração ganha as colunas do CREF. O tipo de retorno muda,
-- então a função sai e volta.
drop function public.admin_list_professionals();

create function public.admin_list_professionals()
returns table (
  user_id uuid,
  email text,
  profession text,
  display_name text,
  council_region text,
  council_number text,
  cref_number text,
  cref_region text,
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
           p.council_number, p.cref_number, p.cref_region, p.status, p.rejection_reason,
           p.requested_at, p.reviewed_at
    from public.professional_profiles p
    join auth.users u on u.id = p.user_id
    order by p.requested_at;
end;
$$;

revoke execute on function public.admin_list_professionals() from public;
revoke execute on function public.admin_list_professionals() from anon;
grant execute on function public.admin_list_professionals() to authenticated;

-- O convite e a lista de quem acompanha o paciente mostram o registro. Com o
-- CRN opcional, juntar região e número daria vazio para quem só tem CREF.
create or replace function public.get_invite(p_token text)
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
    public.professional_councils(v_pro),
    coalesce(auth.uid() = v_invite.professional_id, false);
end;
$$;

create or replace function public.my_care_links()
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
    select l.id, p.display_name, public.professional_councils(p), l.status,
           l.share_diary, l.share_body, l.share_profile, l.created_at, l.ended_at
    from public.care_links l
    join public.professional_profiles p on p.user_id = l.professional_id
    where l.patient_id = auth.uid()
    order by l.created_at desc;
end;
$$;
