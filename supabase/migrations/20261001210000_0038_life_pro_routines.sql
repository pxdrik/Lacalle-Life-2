-- Life Pro, Etapa 8b (docs/visao-adm-plano.md): o treino que o treinador
-- monta e publica para um paciente (protótipo aprovado em 01/10/2026).
--
-- O mesmo caminho do plano alimentar (0035, 0036), com o conteúdo no formato
-- das rotinas do app (`notes` e `exercises`: exercícios do catálogo, séries
-- com peso, repetições e RPE, descanso e observação). Cada prescrição é uma
-- rotina (decisão do Pedro: "uma rotina só"); A, B e C são três.
--
-- Regras, as mesmas do plano:
-- - Rascunho só do treinador; publicar cria versão nova e imutável.
-- - O paciente lê as versões dos treinos que são para ele, inclusive depois
--   de encerrar o vínculo (fica como leitura, sem versões novas).
-- - Publicar exige vínculo ativo e treinador aprovado (`active_link_of`).
-- - Dias da semana opcionais, escolhidos pelo treinador: sem nenhum, o
--   paciente faz quando quiser (padrão, ao contrário do plano alimentar).

create table public.prescribed_routines (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.care_links(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prescribed_routines_patient_idx on public.prescribed_routines (patient_id);
create index prescribed_routines_professional_idx on public.prescribed_routines (professional_id);

alter table public.prescribed_routines enable row level security;

create policy "prescribed_routines_select_party"
  on public.prescribed_routines for select
  using (auth.uid() = professional_id or auth.uid() = patient_id);

revoke insert, update, delete on public.prescribed_routines from anon, authenticated;

create table public.prescribed_routine_versions (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.prescribed_routines(id) on delete cascade,
  version integer not null check (version >= 1),
  name text not null,
  notes text not null default '' check (char_length(notes) <= 2000),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array'),
  weekdays text[] not null default '{}'::text[]
    check (weekdays <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]),
  change_note text not null default '' check (char_length(change_note) <= 500),
  published_at timestamptz not null default now(),
  unique (routine_id, version)
);

alter table public.prescribed_routine_versions enable row level security;

create policy "prescribed_routine_versions_select_party"
  on public.prescribed_routine_versions for select
  using (exists (
    select 1 from public.prescribed_routines r
    where r.id = routine_id and (auth.uid() = r.professional_id or auth.uid() = r.patient_id)
  ));

revoke insert, update, delete on public.prescribed_routine_versions from anon, authenticated;

create table public.prescribed_routine_drafts (
  routine_id uuid primary key references public.prescribed_routines(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  notes text not null default '' check (char_length(notes) <= 2000),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array'),
  weekdays text[] not null default '{}'::text[]
    check (weekdays <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]),
  updated_at timestamptz not null default now()
);

alter table public.prescribed_routine_drafts enable row level security;

create policy "prescribed_routine_drafts_select_professional"
  on public.prescribed_routine_drafts for select
  using (exists (
    select 1 from public.prescribed_routines r where r.id = routine_id and auth.uid() = r.professional_id
  ));

revoke insert, update, delete on public.prescribed_routine_drafts from anon, authenticated;

-- A forma mínima que o banco confere; o app valida o formato completo (zod)
-- ao ler, como no plano.
create function public.check_routine_exercises(p_exercises jsonb) returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' then
    raise exception 'invalid routine';
  end if;
  if jsonb_array_length(p_exercises) > 40 then
    raise exception 'too many exercises';
  end if;
  if octet_length(p_exercises::text) > 200000 then
    raise exception 'routine too large';
  end if;
end;
$$;

revoke execute on function public.check_routine_exercises(jsonb) from public;
revoke execute on function public.check_routine_exercises(jsonb) from anon;
revoke execute on function public.check_routine_exercises(jsonb) from authenticated;

-- Cria o treino (sem `p_routine_id`) ou atualiza o rascunho dele. Rascunho
-- não chega ao paciente.
create function public.save_routine_draft(
  p_routine_id uuid,
  p_link_id uuid,
  p_name text,
  p_notes text,
  p_exercises jsonb,
  p_weekdays text[] default '{}'::text[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.care_links;
  v_routine uuid := p_routine_id;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.check_routine_exercises(p_exercises);
  if p_weekdays is null
    or not (p_weekdays <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]) then
    raise exception 'invalid weekdays';
  end if;
  v_link := public.active_link_of(p_link_id);

  if v_routine is null then
    insert into public.prescribed_routines (link_id, professional_id, patient_id, name)
    values (v_link.id, v_link.professional_id, v_link.patient_id, btrim(p_name))
    returning id into v_routine;
  elsif not exists (
    select 1 from public.prescribed_routines where id = v_routine and link_id = v_link.id
  ) then
    raise exception 'not found';
  end if;

  insert into public.prescribed_routine_drafts (routine_id, name, notes, exercises, weekdays)
  values (v_routine, btrim(p_name), coalesce(p_notes, ''), p_exercises, p_weekdays)
  on conflict (routine_id) do update
    set name = excluded.name, notes = excluded.notes, exercises = excluded.exercises,
        weekdays = excluded.weekdays, updated_at = now();

  return v_routine;
end;
$$;

revoke execute on function public.save_routine_draft(uuid, uuid, text, text, jsonb, text[]) from public;
revoke execute on function public.save_routine_draft(uuid, uuid, text, text, jsonb, text[]) from anon;
grant execute on function public.save_routine_draft(uuid, uuid, text, text, jsonb, text[]) to authenticated;

-- Publica o rascunho como versão nova; a anterior nunca muda.
create function public.publish_routine(p_routine_id uuid, p_change_note text) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_routine public.prescribed_routines;
  v_draft public.prescribed_routine_drafts;
  v_version integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into v_routine from public.prescribed_routines
    where id = p_routine_id and professional_id = auth.uid() for update;
  if not found then
    raise exception 'not found';
  end if;
  perform public.active_link_of(v_routine.link_id);

  select * into v_draft from public.prescribed_routine_drafts where routine_id = p_routine_id;
  if not found then
    raise exception 'no draft';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.prescribed_routine_versions where routine_id = p_routine_id;

  insert into public.prescribed_routine_versions
    (routine_id, version, name, notes, exercises, weekdays, change_note)
  values
    (p_routine_id, v_version, v_draft.name, v_draft.notes, v_draft.exercises, v_draft.weekdays,
     coalesce(btrim(p_change_note), ''));

  update public.prescribed_routines set name = v_draft.name, updated_at = now() where id = p_routine_id;
  delete from public.prescribed_routine_drafts where routine_id = p_routine_id;

  return v_version;
end;
$$;

revoke execute on function public.publish_routine(uuid, text) from public;
revoke execute on function public.publish_routine(uuid, text) from anon;
grant execute on function public.publish_routine(uuid, text) to authenticated;
