-- Perfil: singleton por usuário, tal como PROFILE_ID = "me" localmente.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Evolução corporal: id local já é o dia.
create table public.body_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  weight_kg numeric,
  body_fat_percent numeric,
  measurements jsonb not null default '{}'::jsonb,
  notes text not null default '',
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Dietas: aggregate root, documento inteiro.
create table public.diets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index diets_user_sync_idx on public.diets (user_id, server_updated_at);

-- Diário: id local já é o dia. Único com merge estruturado por Meal.id no
-- motor de sync (cliente), não no SQL.
create table public.food_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  payload jsonb not null,
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Rotinas: aggregate root, documento inteiro.
create table public.routines (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index routines_user_sync_idx on public.routines (user_id, server_updated_at);

-- Sessões: só sincroniza com finished_at preenchido. routine_id é
-- referência solta (cópia congelada) — sem FK de propósito.
create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid,
  name text not null,
  started_at bigint not null,
  finished_at bigint,
  payload jsonb not null,
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);
create index sessions_user_sync_idx on public.workout_sessions (user_id, server_updated_at);

-- Alimentos e exercícios personalizados — nunca o catálogo (que fica local,
-- versionado no bundle do app, nunca vira tabela por usuário).
create table public.user_custom_foods (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_custom_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Favoritos: sem tombstone de propósito (booleano puro, sem valor autoral).
-- food_id/exercise_id aceita tanto slug de catálogo quanto uuid de
-- user_custom_*, por isso `text` e não `uuid`.
create table public.user_food_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id text not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

create table public.user_exercise_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
