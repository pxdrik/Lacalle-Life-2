-- Life Pro: modelo de treino na Biblioteca (pedido do Pedro, protótipo
-- aprovado em 02/10/2026). O par de `plan_templates` (0035), no formato das
-- rotinas do app, como o treino prescrito (0038).
--
-- - O modelo é só do treinador e independente dos treinos: usar um modelo
--   copia os exercícios para o rascunho de um treino novo, e mudar o modelo
--   depois não mexe em treino nenhum.
-- - Sem dias: os dias são de cada paciente, escolhidos quando o modelo vira
--   um treino dele.

create table public.routine_templates (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  notes text not null default '' check (char_length(notes) <= 2000),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index routine_templates_professional_idx on public.routine_templates (professional_id);

alter table public.routine_templates enable row level security;

create policy "routine_templates_select_own"
  on public.routine_templates for select
  using (auth.uid() = professional_id);

revoke insert, update, delete on public.routine_templates from anon, authenticated;

create function public.save_routine_template(p_template_id uuid, p_name text, p_notes text, p_exercises jsonb)
returns uuid
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
  perform public.check_routine_exercises(p_exercises);

  if v_id is null then
    insert into public.routine_templates (professional_id, name, notes, exercises)
    values (auth.uid(), btrim(p_name), coalesce(p_notes, ''), p_exercises)
    returning id into v_id;
  else
    update public.routine_templates
      set name = btrim(p_name), notes = coalesce(p_notes, ''), exercises = p_exercises, updated_at = now()
      where id = v_id and professional_id = auth.uid();
    if not found then
      raise exception 'not found';
    end if;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.save_routine_template(uuid, text, text, jsonb) from public;
revoke execute on function public.save_routine_template(uuid, text, text, jsonb) from anon;
grant execute on function public.save_routine_template(uuid, text, text, jsonb) to authenticated;

create function public.delete_routine_template(p_template_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.routine_templates where id = p_template_id and professional_id = auth.uid();
  if not found then
    raise exception 'not found';
  end if;
end;
$$;

revoke execute on function public.delete_routine_template(uuid) from public;
revoke execute on function public.delete_routine_template(uuid) from anon;
grant execute on function public.delete_routine_template(uuid) to authenticated;
