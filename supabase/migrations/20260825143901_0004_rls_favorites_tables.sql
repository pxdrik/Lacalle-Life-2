-- Único par de tabelas sem OCC e sem tombstone (§18.4): favorito é um
-- booleano puro sem valor autoral, então INSERT/DELETE direto é seguro sob
-- RLS de propriedade sozinha — perder uma corrida rara só significa
-- favoritar de novo, nunca perde um fato que aconteceu.

alter table public.user_food_favorites enable row level security;
create policy "user_food_favorites_select_own" on public.user_food_favorites for select using (auth.uid() = user_id);
create policy "user_food_favorites_insert_own" on public.user_food_favorites for insert with check (auth.uid() = user_id);
create policy "user_food_favorites_delete_own" on public.user_food_favorites for delete using (auth.uid() = user_id);

alter table public.user_exercise_favorites enable row level security;
create policy "user_exercise_favorites_select_own" on public.user_exercise_favorites for select using (auth.uid() = user_id);
create policy "user_exercise_favorites_insert_own" on public.user_exercise_favorites for insert with check (auth.uid() = user_id);
create policy "user_exercise_favorites_delete_own" on public.user_exercise_favorites for delete using (auth.uid() = user_id);
