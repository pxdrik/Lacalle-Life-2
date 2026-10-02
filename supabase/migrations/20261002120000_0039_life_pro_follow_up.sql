-- Life Pro, Etapa 6 (docs/visao-adm-plano.md): o acompanhamento. O treinador
-- lê o que o paciente faz, só o que ele libera (protótipo aprovado em
-- 02/10/2026: https://claude.ai/artifact/G9aujUmqExhv2V3Hgvr37x).
--
-- - "Treinos" é um item novo no que o paciente libera (decisão do Pedro),
--   ao lado de diário, evolução e perfil. Vínculos de antes começam com ele
--   desligado: o paciente nunca viu essa opção.
-- - A leitura é por funções, nunca abrindo as tabelas do paciente: cada uma
--   confere vínculo ativo, treinador aprovado e o item liberado, e entrega
--   só os campos que a tela usa, sem lápides.
-- - Só leitura. Nada aqui escreve no que é do paciente.

alter table public.care_links add column share_workouts boolean not null default false;

-- O aceite e a mudança do que é liberado levam o item novo. O parâmetro tem
-- padrão para quem chama sem ele (a prévia de antes desta migração): no
-- aceite, desligado; na mudança, mantém o que estava.
drop function public.accept_invite(text, boolean, boolean, boolean);

create function public.accept_invite(
  p_token text,
  p_share_diary boolean,
  p_share_body boolean,
  p_share_profile boolean,
  p_share_workouts boolean default false
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
      (professional_id, patient_id, patient_label, share_diary, share_body, share_profile, share_workouts)
    values
      (v_invite.professional_id, v_uid, v_invite.patient_label, p_share_diary, p_share_body, p_share_profile,
       coalesce(p_share_workouts, false))
    returning id into v_link;
  else
    update public.care_links
      set share_diary = p_share_diary, share_body = p_share_body, share_profile = p_share_profile,
          share_workouts = coalesce(p_share_workouts, false)
      where id = v_link;
  end if;

  update public.care_invites
    set status = 'accepted', accepted_at = now(), link_id = v_link
    where id = v_invite.id;

  return v_link;
end;
$$;

revoke execute on function public.accept_invite(text, boolean, boolean, boolean, boolean) from public;
revoke execute on function public.accept_invite(text, boolean, boolean, boolean, boolean) from anon;
grant execute on function public.accept_invite(text, boolean, boolean, boolean, boolean) to authenticated;

drop function public.update_link_sharing(uuid, boolean, boolean, boolean);

create function public.update_link_sharing(
  p_link_id uuid,
  p_share_diary boolean,
  p_share_body boolean,
  p_share_profile boolean,
  p_share_workouts boolean default null
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
    set share_diary = p_share_diary, share_body = p_share_body, share_profile = p_share_profile,
        share_workouts = coalesce(p_share_workouts, share_workouts)
    where id = p_link_id and patient_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'not found';
  end if;
end;
$$;

revoke execute on function public.update_link_sharing(uuid, boolean, boolean, boolean, boolean) from public;
revoke execute on function public.update_link_sharing(uuid, boolean, boolean, boolean, boolean) from anon;
grant execute on function public.update_link_sharing(uuid, boolean, boolean, boolean, boolean) to authenticated;

-- O paciente vê o item novo no Acompanhamento. O tipo de retorno muda.
drop function public.my_care_links();

create function public.my_care_links()
returns table (
  link_id uuid,
  professional_name text,
  council text,
  status text,
  share_diary boolean,
  share_body boolean,
  share_profile boolean,
  share_workouts boolean,
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
           l.share_diary, l.share_body, l.share_profile, l.share_workouts, l.created_at, l.ended_at
    from public.care_links l
    join public.professional_profiles p on p.user_id = l.professional_id
    where l.patient_id = auth.uid()
    order by l.created_at desc;
end;
$$;

revoke execute on function public.my_care_links() from public;
revoke execute on function public.my_care_links() from anon;
grant execute on function public.my_care_links() to authenticated;

-- ---------------------------------------------------------------------------
-- Leitura do treinador
-- ---------------------------------------------------------------------------
-- O vínculo ativo do treinador logado, com o item liberado. Recusa os dois
-- casos com motivos diferentes, para a tela dizer "não libera" em vez de
-- "erro".
create function public.shared_link_of(p_link_id uuid, p_item text) returns public.care_links
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_link public.care_links := public.active_link_of(p_link_id);
begin
  if not coalesce(case p_item
    when 'diary' then v_link.share_diary
    when 'body' then v_link.share_body
    when 'workouts' then v_link.share_workouts
    else false
  end, false) then
    raise exception 'not shared';
  end if;
  return v_link;
end;
$$;

revoke execute on function public.shared_link_of(uuid, text) from public;
revoke execute on function public.shared_link_of(uuid, text) from anon;
revoke execute on function public.shared_link_of(uuid, text) from authenticated;

-- Os treinos finalizados do paciente desde `p_since` (milissegundos, como o
-- app grava), mais novo primeiro. Treino em andamento não aparece.
create function public.pro_patient_sessions(p_link_id uuid, p_since bigint)
returns table (id uuid, routine_id uuid, name text, started_at bigint, finished_at bigint, payload jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_link public.care_links := public.shared_link_of(p_link_id, 'workouts');
begin
  return query
    select s.id, s.routine_id, s.name, s.started_at, s.finished_at, s.payload
    from public.workout_sessions s
    where s.user_id = v_link.patient_id and s.deleted_at is null
      and s.finished_at is not null and s.started_at >= p_since
    order by s.started_at desc
    limit 200;
end;
$$;

revoke execute on function public.pro_patient_sessions(uuid, bigint) from public;
revoke execute on function public.pro_patient_sessions(uuid, bigint) from anon;
grant execute on function public.pro_patient_sessions(uuid, bigint) to authenticated;

-- O diário do paciente entre dois dias (no máximo dois meses por leitura).
create function public.pro_patient_diary(p_link_id uuid, p_from date, p_to date)
returns table (day date, payload jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_link public.care_links := public.shared_link_of(p_link_id, 'diary');
begin
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'invalid range';
  end if;
  return query
    select f.day, f.payload
    from public.food_logs f
    where f.user_id = v_link.patient_id and f.deleted_at is null and f.day between p_from and p_to
    order by f.day;
end;
$$;

revoke execute on function public.pro_patient_diary(uuid, date, date) from public;
revoke execute on function public.pro_patient_diary(uuid, date, date) from anon;
grant execute on function public.pro_patient_diary(uuid, date, date) to authenticated;

-- Peso e medidas do paciente, do mais antigo ao mais novo. Fotos não
-- existem no banco, e as notas ficam com ele.
create function public.pro_patient_body(p_link_id uuid)
returns table (day date, weight_kg numeric, body_fat_percent numeric, measurements jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_link public.care_links := public.shared_link_of(p_link_id, 'body');
begin
  return query
    select b.day, b.weight_kg, b.body_fat_percent, b.measurements
    from public.body_entries b
    where b.user_id = v_link.patient_id and b.deleted_at is null
    order by b.day
    limit 500;
end;
$$;

revoke execute on function public.pro_patient_body(uuid) from public;
revoke execute on function public.pro_patient_body(uuid) from anon;
grant execute on function public.pro_patient_body(uuid) to authenticated;

-- A Visão geral: por vínculo ativo do treinador logado, só o que cada um
-- libera (o resto vem nulo). `sessions` são os treinos desde `p_since`, para
-- a tela comparar com os dias do treino prescrito.
create function public.pro_overview(p_since bigint)
returns table (
  link_id uuid,
  share_diary boolean,
  share_body boolean,
  share_workouts boolean,
  last_session_at bigint,
  sessions jsonb,
  last_diary_day date,
  weight_now numeric,
  weight_month_ago numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_approved_professional(auth.uid()) then
    raise exception 'not an approved professional';
  end if;
  return query
    select
      l.id, l.share_diary, l.share_body, l.share_workouts,
      case when l.share_workouts then (
        select max(s.started_at) from public.workout_sessions s
        where s.user_id = l.patient_id and s.deleted_at is null and s.finished_at is not null
      ) end,
      case when l.share_workouts then coalesce((
        select jsonb_agg(jsonb_build_object('routineId', s.routine_id, 'startedAt', s.started_at) order by s.started_at)
        from public.workout_sessions s
        where s.user_id = l.patient_id and s.deleted_at is null and s.finished_at is not null
          and s.started_at >= p_since
      ), '[]'::jsonb) end,
      case when l.share_diary then (
        select max(f.day) from public.food_logs f
        where f.user_id = l.patient_id and f.deleted_at is null and f.day <= current_date
      ) end,
      case when l.share_body then (
        select b.weight_kg from public.body_entries b
        where b.user_id = l.patient_id and b.deleted_at is null and b.weight_kg is not null
        order by b.day desc limit 1
      ) end,
      case when l.share_body then (
        select b.weight_kg from public.body_entries b
        where b.user_id = l.patient_id and b.deleted_at is null and b.weight_kg is not null
          and b.day <= current_date - 30
        order by b.day desc limit 1
      ) end
    from public.care_links l
    where l.professional_id = auth.uid() and l.status = 'active'
    order by l.created_at;
end;
$$;

revoke execute on function public.pro_overview(bigint) from public;
revoke execute on function public.pro_overview(bigint) from anon;
grant execute on function public.pro_overview(bigint) to authenticated;
