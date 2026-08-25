-- As oito tabelas com controle de versão otimista (OCC): RLS liga
-- propriedade da linha ao dono; a única porta de escrita é a função
-- security definer (migration seguinte) — INSERT/UPDATE direto na tabela
-- fica revogado de authenticated e anon. Ver docs/arquitetura-sincronizacao.md
-- §18.3/§19.1: sem isso, RLS de UPDATE sozinho não impõe o OCC.

alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
revoke insert, update on public.profiles from authenticated;
revoke insert, update on public.profiles from anon;
create trigger profiles_set_server_updated_at before insert or update on public.profiles for each row execute function public.set_server_updated_at();

alter table public.body_entries enable row level security;
create policy "body_entries_select_own" on public.body_entries for select using (auth.uid() = user_id);
revoke insert, update on public.body_entries from authenticated;
revoke insert, update on public.body_entries from anon;
create trigger body_entries_set_server_updated_at before insert or update on public.body_entries for each row execute function public.set_server_updated_at();

alter table public.diets enable row level security;
create policy "diets_select_own" on public.diets for select using (auth.uid() = user_id);
revoke insert, update on public.diets from authenticated;
revoke insert, update on public.diets from anon;
create trigger diets_set_server_updated_at before insert or update on public.diets for each row execute function public.set_server_updated_at();

alter table public.food_logs enable row level security;
create policy "food_logs_select_own" on public.food_logs for select using (auth.uid() = user_id);
revoke insert, update on public.food_logs from authenticated;
revoke insert, update on public.food_logs from anon;
create trigger food_logs_set_server_updated_at before insert or update on public.food_logs for each row execute function public.set_server_updated_at();

alter table public.routines enable row level security;
create policy "routines_select_own" on public.routines for select using (auth.uid() = user_id);
revoke insert, update on public.routines from authenticated;
revoke insert, update on public.routines from anon;
create trigger routines_set_server_updated_at before insert or update on public.routines for each row execute function public.set_server_updated_at();

alter table public.workout_sessions enable row level security;
create policy "workout_sessions_select_own" on public.workout_sessions for select using (auth.uid() = user_id);
revoke insert, update on public.workout_sessions from authenticated;
revoke insert, update on public.workout_sessions from anon;
create trigger workout_sessions_set_server_updated_at before insert or update on public.workout_sessions for each row execute function public.set_server_updated_at();

alter table public.user_custom_foods enable row level security;
create policy "user_custom_foods_select_own" on public.user_custom_foods for select using (auth.uid() = user_id);
revoke insert, update on public.user_custom_foods from authenticated;
revoke insert, update on public.user_custom_foods from anon;
create trigger user_custom_foods_set_server_updated_at before insert or update on public.user_custom_foods for each row execute function public.set_server_updated_at();

alter table public.user_custom_exercises enable row level security;
create policy "user_custom_exercises_select_own" on public.user_custom_exercises for select using (auth.uid() = user_id);
revoke insert, update on public.user_custom_exercises from authenticated;
revoke insert, update on public.user_custom_exercises from anon;
create trigger user_custom_exercises_set_server_updated_at before insert or update on public.user_custom_exercises for each row execute function public.set_server_updated_at();
