-- Life Pro, Etapa 5e (docs/visao-adm-plano.md): os dias do plano são da
-- nutricionista, não do paciente (decisão do Pedro, 01/10/2026).
--
-- Até a 0035 os dias moravam em `plan_schedules`, escolhidos pelo paciente.
-- Agora fazem parte da prescrição: entram no rascunho e em cada versão, e
-- mudar os dias é mudar o plano (aparece no "o que mudou" da versão nova).
--
-- - Padrão: todos os dias, como na primeira publicação da 0035.
-- - O paciente perde a função de mudar os dias. `plan_schedules` não é
--   apagada (nada nesta migração apaga dado), só deixa de ser usada.

alter table public.prescribed_plan_drafts
  add column weekdays text[] not null
    default array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
    check (weekdays <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]);

alter table public.prescribed_plan_versions
  add column weekdays text[] not null
    default array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
    check (weekdays <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]);

-- O que já foi publicado com dias escolhidos pelo paciente leva esses dias
-- para a versão, para nada mudar no Diário de ninguém com esta migração.
update public.prescribed_plan_versions v
  set weekdays = s.weekdays
  from public.plan_schedules s
  where s.plan_id = v.plan_id;

-- E o rascunho que já existia também: publicado com o padrão (todos), ele
-- trocaria em silêncio os dias que o plano tem hoje.
update public.prescribed_plan_drafts d
  set weekdays = s.weekdays
  from public.plan_schedules s
  where s.plan_id = d.plan_id;

-- O rascunho passa a levar os dias. A assinatura muda, então a função antiga
-- sai (nenhum app publicado a chama: o Life Pro ainda não está no site).
drop function public.save_plan_draft(uuid, uuid, text, jsonb);

create function public.save_plan_draft(
  p_plan_id uuid,
  p_link_id uuid,
  p_name text,
  p_meals jsonb,
  p_weekdays text[] default array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
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
  if p_weekdays is null
    or not (p_weekdays <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]) then
    raise exception 'invalid weekdays';
  end if;
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

  insert into public.prescribed_plan_drafts (plan_id, name, meals, weekdays)
  values (v_plan, btrim(p_name), p_meals, p_weekdays)
  on conflict (plan_id) do update
    set name = excluded.name, meals = excluded.meals, weekdays = excluded.weekdays, updated_at = now();

  return v_plan;
end;
$$;

revoke execute on function public.save_plan_draft(uuid, uuid, text, jsonb, text[]) from public;
revoke execute on function public.save_plan_draft(uuid, uuid, text, jsonb, text[]) from anon;
grant execute on function public.save_plan_draft(uuid, uuid, text, jsonb, text[]) to authenticated;

-- Publicar leva os dias do rascunho para a versão.
create or replace function public.publish_plan(p_plan_id uuid, p_change_note text) returns integer
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

  insert into public.prescribed_plan_versions (plan_id, version, name, meals, change_note, weekdays)
  values (p_plan_id, v_version, v_draft.name, v_draft.meals, coalesce(btrim(p_change_note), ''), v_draft.weekdays);

  update public.prescribed_plans set name = v_draft.name, updated_at = now() where id = p_plan_id;
  delete from public.prescribed_plan_drafts where plan_id = p_plan_id;

  return v_version;
end;
$$;

-- O paciente não muda mais os dias do plano.
revoke execute on function public.set_plan_schedule(uuid, text[]) from authenticated;
