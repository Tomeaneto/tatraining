-- =============================================================================
-- TA Triathlon — schema do Supabase
-- Rode no SQL Editor do Supabase (pode rodar de novo: é idempotente).
-- Cada linha pertence a um usuário do Supabase Auth; o RLS garante que
-- cada um só enxerga e altera os próprios dados.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfil do atleta + configurações do programa (1 linha por usuário)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  name           text not null default 'Tomé Brígido de Almeida',
  birth_year     smallint,
  age            smallint not null default 33 check (age between 10 and 100),
  sex            text not null default 'M' check (sex in ('M', 'F')),
  height_cm      numeric(5, 1) not null default 172,
  hr_max         smallint not null default 185 check (hr_max between 120 and 230),
  hr_max_source  text not null default 'estimated' check (hr_max_source in ('estimated', 'measured')),
  start_date     date not null default current_date,
  race_date      date not null default (current_date + interval '12 months')::date,
  -- proporção das fases em semanas: base, construção, específico, pico
  phase_weeks    smallint[] not null default '{16,16,14,6}'
                 check (array_length(phase_weeks, 1) = 4 and 0 < all (phase_weeks)),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint race_after_start check (race_date >= start_date + 56)
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Treinos realizados (manuais, do plano, Strava e Garmin)
-- -----------------------------------------------------------------------------
create table if not exists public.workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date          date not null,
  sport         text not null check (sport in ('swim', 'bike', 'run', 'strength', 'brick', 'race', 'rest')),
  duration_min  integer not null check (duration_min >= 0),
  distance_km   numeric(7, 3) check (distance_km >= 0),
  avg_hr        smallint check (avg_hr between 30 and 230),
  rpe           smallint check (rpe between 1 and 10),
  name          text,
  notes         text,
  source        text not null default 'manual' check (source in ('manual', 'plan', 'strava', 'garmin')),
  external_id   text,  -- id no Strava/Garmin, evita importar duas vezes
  planned_date  date,  -- sessão do plano que este treino cumpre
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists workouts_external_uniq
  on public.workouts (user_id, source, external_id)
  where external_id is not null;
create index if not exists workouts_user_date_idx on public.workouts (user_id, date desc);
create index if not exists workouts_user_planned_idx on public.workouts (user_id, planned_date)
  where planned_date is not null;

drop trigger if exists workouts_updated_at on public.workouts;
create trigger workouts_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Avaliações de composição corporal (InBody)
-- -----------------------------------------------------------------------------
create table if not exists public.body_compositions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date                 date not null,
  is_baseline          boolean not null default false,

  weight_kg            numeric(5, 1) not null check (weight_kg > 0),
  skeletal_muscle_kg   numeric(5, 1) not null,
  fat_mass_kg          numeric(5, 1) not null,
  body_fat_pct         numeric(4, 1) not null check (body_fat_pct between 0 and 100),
  bmi                  numeric(4, 1) not null,
  total_body_water_l   numeric(5, 1) not null,
  protein_kg           numeric(5, 1) not null,
  minerals_kg          numeric(5, 2) not null,
  bmr_kcal             integer not null,
  waist_hip_ratio      numeric(4, 2) not null,
  visceral_fat_level   smallint not null,
  obesity_degree_pct   smallint not null,
  inbody_score         smallint not null check (inbody_score between 0 and 100),
  ideal_weight_kg      numeric(5, 1) not null,
  fat_control_kg       numeric(5, 1) not null,

  -- massa magra segmentar (kg)
  lean_right_arm       numeric(5, 2) not null,
  lean_left_arm        numeric(5, 2) not null,
  lean_trunk           numeric(5, 2) not null,
  lean_right_leg       numeric(5, 2) not null,
  lean_left_leg        numeric(5, 2) not null,
  -- gordura segmentar (kg)
  fat_right_arm        numeric(5, 2) not null,
  fat_left_arm         numeric(5, 2) not null,
  fat_trunk            numeric(5, 2) not null,
  fat_right_leg        numeric(5, 2) not null,
  fat_left_leg         numeric(5, 2) not null,

  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- só uma linha de base por usuário
create unique index if not exists body_baseline_uniq
  on public.body_compositions (user_id)
  where is_baseline;
create index if not exists body_user_date_idx on public.body_compositions (user_id, date);

drop trigger if exists body_compositions_updated_at on public.body_compositions;
create trigger body_compositions_updated_at
  before update on public.body_compositions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tokens do Strava — SOMENTE servidor.
-- RLS ligado e sem políticas: o navegador (anon/authenticated) não lê nem grava.
-- Só as Vercel Functions, com a service_role key, acessam esta tabela.
-- -----------------------------------------------------------------------------
create table if not exists public.strava_connections (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  athlete_id     bigint,
  athlete_name   text,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null,
  last_sync_at   timestamptz,
  updated_at     timestamptz not null default now()
);

drop trigger if exists strava_connections_updated_at on public.strava_connections;
create trigger strava_connections_updated_at
  before update on public.strava_connections
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.workouts           enable row level security;
alter table public.body_compositions  enable row level security;
alter table public.strava_connections enable row level security;

-- profiles
drop policy if exists "profiles: ler o próprio"     on public.profiles;
drop policy if exists "profiles: criar o próprio"   on public.profiles;
drop policy if exists "profiles: editar o próprio"  on public.profiles;
create policy "profiles: ler o próprio"    on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "profiles: criar o próprio"  on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "profiles: editar o próprio" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- workouts
drop policy if exists "workouts: ler os próprios"     on public.workouts;
drop policy if exists "workouts: criar os próprios"   on public.workouts;
drop policy if exists "workouts: editar os próprios"  on public.workouts;
drop policy if exists "workouts: excluir os próprios" on public.workouts;
create policy "workouts: ler os próprios"     on public.workouts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "workouts: criar os próprios"   on public.workouts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "workouts: editar os próprios"  on public.workouts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workouts: excluir os próprios" on public.workouts for delete to authenticated
  using (user_id = (select auth.uid()));

-- body_compositions (a linha de base não pode ser excluída)
drop policy if exists "body: ler as próprias"     on public.body_compositions;
drop policy if exists "body: criar as próprias"   on public.body_compositions;
drop policy if exists "body: editar as próprias"  on public.body_compositions;
drop policy if exists "body: excluir as próprias" on public.body_compositions;
create policy "body: ler as próprias"     on public.body_compositions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "body: criar as próprias"   on public.body_compositions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "body: editar as próprias"  on public.body_compositions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "body: excluir as próprias" on public.body_compositions for delete to authenticated
  using (user_id = (select auth.uid()) and not is_baseline);

-- -----------------------------------------------------------------------------
-- Novo usuário → cria o perfil e a linha de base do InBody (26/01/2026)
-- -----------------------------------------------------------------------------
create or replace function public.seed_new_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, birth_year)
  values (p_user_id, 1993)
  on conflict (user_id) do nothing;

  insert into public.body_compositions (
    user_id, date, is_baseline,
    weight_kg, skeletal_muscle_kg, fat_mass_kg, body_fat_pct, bmi,
    total_body_water_l, protein_kg, minerals_kg, bmr_kcal,
    waist_hip_ratio, visceral_fat_level, obesity_degree_pct, inbody_score,
    ideal_weight_kg, fat_control_kg,
    lean_right_arm, lean_left_arm, lean_trunk, lean_right_leg, lean_left_leg,
    fat_right_arm,  fat_left_arm,  fat_trunk,  fat_right_leg,  fat_left_leg
  )
  values (
    p_user_id, '2026-01-26', true,
    106.2, 39.4, 37.5, 35.3, 35.9,
    50.3, 13.7, 4.6, 1854,
    0.96, 16, 163, 68,
    80.9, -25.3,
    4.27, 4.27, 31.97, 10.74, 10.56,
    3, 3, 20, 5, 5
  )
  on conflict do nothing;  -- body_baseline_uniq impede duplicar
end;
$$;

revoke all on function public.seed_new_user(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_new_user(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuários que já existiam antes deste script também recebem perfil + linha de base.
select public.seed_new_user(id) from auth.users;

-- -----------------------------------------------------------------------------
-- Dieta: refeições registradas pelo bot do Telegram (analisadas pelo Gemini)
-- -----------------------------------------------------------------------------
create table if not exists public.meals (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date                 date not null,
  eaten_at             timestamptz not null default now(),
  meal_type            text not null default 'other' check (meal_type in (
                         'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper',
                         'pre_workout', 'post_workout', 'other')),
  description          text not null,
  -- [{ name, quantity, kcal, protein_g, carbs_g, fat_g }]
  items                jsonb not null default '[]'::jsonb,
  kcal                 integer check (kcal >= 0),
  protein_g            numeric(6, 1) check (protein_g >= 0),
  carbs_g              numeric(6, 1) check (carbs_g >= 0),
  fat_g                numeric(6, 1) check (fat_g >= 0),
  fiber_g              numeric(6, 1) check (fiber_g >= 0),
  feedback             text,   -- comentário do Gemini sobre a refeição
  source               text not null default 'telegram' check (source in ('telegram', 'manual')),
  telegram_chat_id     bigint,
  telegram_message_id  bigint,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- o Telegram reenvia a mesma mensagem se o webhook demorar: não duplica a refeição
create unique index if not exists meals_telegram_uniq
  on public.meals (user_id, telegram_chat_id, telegram_message_id)
  where telegram_message_id is not null;
create index if not exists meals_user_date_idx on public.meals (user_id, date desc, eaten_at desc);

drop trigger if exists meals_updated_at on public.meals;
create trigger meals_updated_at
  before update on public.meals
  for each row execute function public.set_updated_at();

alter table public.meals enable row level security;

drop policy if exists "meals: ler as próprias"     on public.meals;
drop policy if exists "meals: criar as próprias"   on public.meals;
drop policy if exists "meals: editar as próprias"  on public.meals;
drop policy if exists "meals: excluir as próprias" on public.meals;
create policy "meals: ler as próprias"     on public.meals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "meals: criar as próprias"   on public.meals for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "meals: editar as próprias"  on public.meals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "meals: excluir as próprias" on public.meals for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Vínculo conta ↔ chat do Telegram — SOMENTE servidor (RLS sem políticas).
-- O app gera um código de uso único; o bot recebe "/start <código>" e grava o chat_id.
-- -----------------------------------------------------------------------------
create table if not exists public.telegram_links (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  chat_id               bigint unique,
  username              text,
  link_code             text unique,
  link_code_expires_at  timestamptz,
  linked_at             timestamptz,
  updated_at            timestamptz not null default now()
);

drop trigger if exists telegram_links_updated_at on public.telegram_links;
create trigger telegram_links_updated_at
  before update on public.telegram_links
  for each row execute function public.set_updated_at();

alter table public.telegram_links enable row level security;
