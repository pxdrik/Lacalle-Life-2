-- Life Pro, Etapa 5 (docs/visao-adm-plano.md): o plano alimentar que a
-- profissional monta e publica para um paciente, e os modelos dela.
--
-- O conteúdo do plano tem o MESMO formato das refeições de uma dieta do app
-- (`meals`: nome, horário, `notes` como orientação da refeição, itens com os
-- nutrientes copiados, `alternatives` como outras opções). Nada de formato
-- novo para o paciente ler; o que é novo é quem escreve e como se publica.
--
-- Regras:
-- - Rascunho: só a profissional lê e escreve (tabela própria, para o
--   paciente nunca ver um plano pela metade).
-- - Publicar cria uma versão nova e imutável; a anterior fica no histórico.
--   Nunca se sobrescreve uma versão publicada.
-- - O paciente lê as versões dos planos que são para ele, inclusive depois de
--   encerrar o vínculo (o plano continua com ele, sem versões novas).
-- - Publicar exige vínculo ativo e profissional aprovada.
-- - Os dias em que o paciente segue o plano são dele (`plan_schedules`).

create table public.prescribed_plans (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.care_links(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prescribed_plans_patient_idx on public.prescribed_plans (patient_id);
create index prescribed_plans_professional_idx on public.prescribed_plans (professional_id);

alter table public.prescribed_plans enable row level security;

create policy "prescribed_plans_select_party"
  on public.prescribed_plans for select
  using (auth.uid() = professional_id or auth.uid() = patient_id);

revoke insert, update, delete on public.prescribed_plans from anon, authenticated;

create table public.prescribed_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.prescribed_plans(id) on delete cascade,
  version integer not null check (version >= 1),
  name text not null,
  meals jsonb not null check (jsonb_typeof(meals) = 'array'),
  -- O que mudou, nas palavras da profissional (opcional).
  change_note text not null default '' check (char_length(change_note) <= 500),
  published_at timestamptz not null default now(),
  unique (plan_id, version)
);

alter table public.prescribed_plan_versions enable row level security;

create policy "prescribed_plan_versions_select_party"
  on public.prescribed_plan_versions for select
  using (exists (
    select 1 from public.prescribed_plans p
    where p.id = plan_id and (auth.uid() = p.professional_id or auth.uid() = p.patient_id)
  ));

revoke insert, update, delete on public.prescribed_plan_versions from anon, authenticated;

create table public.prescribed_plan_drafts (
  plan_id uuid primary key references public.prescribed_plans(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  meals jsonb not null check (jsonb_typeof(meals) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.prescribed_plan_drafts enable row level security;

create policy "prescribed_plan_drafts_select_professional"
  on public.prescribed_plan_drafts for select
  using (exists (
    select 1 from public.prescribed_plans p where p.id = plan_id and auth.uid() = p.professional_id
  ));

revoke insert, update, delete on public.prescribed_plan_drafts from anon, authenticated;

create table public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  meals jsonb not null check (jsonb_typeof(meals) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plan_templates_professional_idx on public.plan_templates (professional_id);

alter table public.plan_templates enable row level security;

create policy "plan_templates_select_own"
  on public.plan_templates for select
  using (auth.uid() = professional_id);

revoke insert, update, delete on public.plan_templates from anon, authenticated;

create table public.plan_schedules (
  plan_id uuid primary key references public.prescribed_plans(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  -- Os mesmos valores de `Weekday` no app ("mon" a "sun").
  weekdays text[] not null
    check (weekdays <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]),
  updated_at timestamptz not null default now()
);

alter table public.plan_schedules enable row level security;

create policy "plan_schedules_select_patient"
  on public.plan_schedules for select
  using (auth.uid() = patient_id);

revoke insert, update, delete on public.plan_schedules from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Conteúdo do plano: a forma mínima que o banco confere antes de aceitar
-- ---------------------------------------------------------------------------
-- O app valida o formato completo (zod) ao ler; aqui o banco recusa o que
-- não pode ser um plano: não-lista, refeições demais, documento grande demais.
create function public.check_plan_meals(p_meals jsonb) returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_meals is null or jsonb_typeof(p_meals) <> 'array' then
    raise exception 'invalid plan';
  end if;
  if jsonb_array_length(p_meals) > 20 then
    raise exception 'too many meals';
  end if;
  if octet_length(p_meals::text) > 200000 then
    raise exception 'plan too large';
  end if;
end;
$$;

revoke execute on function public.check_plan_meals(jsonb) from public;
revoke execute on function public.check_plan_meals(jsonb) from anon;
revoke execute on function public.check_plan_meals(jsonb) from authenticated;

-- O vínculo é desta profissional, está ativo e ela está aprovada.
create function public.active_link_of(p_link_id uuid) returns public.care_links
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_link public.care_links;
begin
  select * into v_link from public.care_links
    where id = p_link_id and professional_id = auth.uid() and status = 'active';
  if not found or not public.is_approved_professional(auth.uid()) then
    raise exception 'no active link';
  end if;
  return v_link;
end;
$$;

revoke execute on function public.active_link_of(uuid) from public;
revoke execute on function public.active_link_of(uuid) from anon;
revoke execute on function public.active_link_of(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- Profissional: rascunho e publicação
-- ---------------------------------------------------------------------------
-- Cria o plano (sem `p_plan_id`) ou atualiza o rascunho dele. Rascunho não
-- aparece para o paciente.
create function public.save_plan_draft(
  p_plan_id uuid,
  p_link_id uuid,
  p_name text,
  p_meals jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.care_links;
  v_plan uuid := p_plan_id;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.check_plan_meals(p_meals);
  v_link := public.active_link_of(p_link_id);

  if v_plan is null then
    insert into public.prescribed_plans (link_id, professional_id, patient_id, name)
    values (v_link.id, v_link.professional_id, v_link.patient_id, btrim(p_name))
    returning id into v_plan;
  elsif not exists (
    select 1 from public.prescribed_plans where id = v_plan and link_id = v_link.id
  ) then
    raise exception 'not found';
  end if;

  insert into public.prescribed_plan_drafts (plan_id, name, meals)
  values (v_plan, btrim(p_name), p_meals)
  on conflict (plan_id) do update
    set name = excluded.name, meals = excluded.meals, updated_at = now();

  return v_plan;
end;
$$;

revoke execute on function public.save_plan_draft(uuid, uuid, text, jsonb) from public;
revoke execute on function public.save_plan_draft(uuid, uuid, text, jsonb) from anon;
grant execute on function public.save_plan_draft(uuid, uuid, text, jsonb) to authenticated;

-- Publica o rascunho como versão nova. Na primeira publicação, o plano passa a
-- valer todos os dias para o paciente (ele muda depois, em Dietas).
create function public.publish_plan(p_plan_id uuid, p_change_note text) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.prescribed_plans;
  v_draft public.prescribed_plan_drafts;
  v_version integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into v_plan from public.prescribed_plans where id = p_plan_id and professional_id = auth.uid() for update;
  if not found then
    raise exception 'not found';
  end if;
  perform public.active_link_of(v_plan.link_id);

  select * into v_draft from public.prescribed_plan_drafts where plan_id = p_plan_id;
  if not found then
    raise exception 'no draft';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.prescribed_plan_versions where plan_id = p_plan_id;

  insert into public.prescribed_plan_versions (plan_id, version, name, meals, change_note)
  values (p_plan_id, v_version, v_draft.name, v_draft.meals, coalesce(btrim(p_change_note), ''));

  update public.prescribed_plans set name = v_draft.name, updated_at = now() where id = p_plan_id;
  delete from public.prescribed_plan_drafts where plan_id = p_plan_id;

  insert into public.plan_schedules (plan_id, patient_id, weekdays)
  values (p_plan_id, v_plan.patient_id, array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[])
  on conflict (plan_id) do nothing;

  return v_version;
end;
$$;

revoke execute on function public.publish_plan(uuid, text) from public;
revoke execute on function public.publish_plan(uuid, text) from anon;
grant execute on function public.publish_plan(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Paciente: em que dias segue o plano
-- ---------------------------------------------------------------------------
create function public.set_plan_schedule(p_plan_id uuid, p_weekdays text[]) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.plan_schedules
    set weekdays = p_weekdays, updated_at = now()
    where plan_id = p_plan_id and patient_id = auth.uid();
  if not found then
    raise exception 'not found';
  end if;
end;
$$;

revoke execute on function public.set_plan_schedule(uuid, text[]) from public;
revoke execute on function public.set_plan_schedule(uuid, text[]) from anon;
grant execute on function public.set_plan_schedule(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Profissional: biblioteca de modelos
-- ---------------------------------------------------------------------------
-- Modelo é independente dos planos: usar um modelo copia o conteúdo para um
-- rascunho, e mudar o modelo depois não mexe em plano nenhum.
create function public.save_plan_template(p_template_id uuid, p_name text, p_meals jsonb) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_template_id;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_approved_professional(auth.uid()) then
    raise exception 'not an approved professional';
  end if;
  perform public.check_plan_meals(p_meals);

  if v_id is null then
    insert into public.plan_templates (professional_id, name, meals)
    values (auth.uid(), btrim(p_name), p_meals)
    returning id into v_id;
  else
    update public.plan_templates
      set name = btrim(p_name), meals = p_meals, updated_at = now()
      where id = v_id and professional_id = auth.uid();
    if not found then
      raise exception 'not found';
    end if;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.save_plan_template(uuid, text, jsonb) from public;
revoke execute on function public.save_plan_template(uuid, text, jsonb) from anon;
grant execute on function public.save_plan_template(uuid, text, jsonb) to authenticated;

create function public.delete_plan_template(p_template_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.plan_templates where id = p_template_id and professional_id = auth.uid();
  if not found then
    raise exception 'not found';
  end if;
end;
$$;

revoke execute on function public.delete_plan_template(uuid) from public;
revoke execute on function public.delete_plan_template(uuid) from anon;
grant execute on function public.delete_plan_template(uuid) to authenticated;
