-- ============================================================
-- ProDT — Migración inicial
-- Mundial 2026 · Gran DT + Prode
-- ============================================================

-- EXTENSIONES
create extension if not exists "uuid-ossp";

-- ============================================================
-- FASES DEL TORNEO
-- ============================================================
create table phases (
  id serial primary key,
  name text not null,
  phase_order integer not null,
  max_per_country integer, -- null = sin límite
  started_at timestamptz
);

insert into phases (name, phase_order, max_per_country) values
  ('Fase de Grupos',   1, 1),
  ('Dieciséisavos',   2, 2),
  ('Cuartos de Final', 3, null),
  ('Semifinal',        4, null),
  ('Final',            5, null);

-- ============================================================
-- SELECCIONES
-- ============================================================
create table countries (
  id serial primary key,
  name text not null,
  code char(3) not null unique,
  flag_url text,
  eliminated boolean default false,
  eliminated_at timestamptz
);

-- ============================================================
-- JUGADORES
-- ============================================================
create table players (
  id serial primary key,
  api_football_id integer unique,
  name text not null,
  country_id integer references countries(id),
  position text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  is_provisional boolean default true,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- PARTIDOS
-- ============================================================
create table matches (
  id serial primary key,
  api_football_id integer unique,
  phase_id integer references phases(id),
  home_country_id integer references countries(id),
  away_country_id integer references countries(id),
  kickoff_at timestamptz not null,
  status text default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  home_score_90 integer,
  away_score_90 integer,
  home_score_et integer,
  away_score_et integer,
  went_to_et boolean default false,
  went_to_penalties boolean default false,
  winner_country_id integer references countries(id),
  mvp_player_id integer references players(id),
  points_published boolean default false
);

-- ============================================================
-- EVENTOS DE PARTIDO
-- ============================================================
create table match_events (
  id serial primary key,
  match_id integer references matches(id),
  player_id integer references players(id),
  event_type text not null check (event_type in (
    'goal', 'assist', 'yellow_card', 'red_card',
    'own_goal', 'penalty_saved', 'clean_sheet', 'mvp'
  )),
  minute integer,
  is_extra_time boolean default false,
  is_overridden boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- PERFILES DE USUARIO
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id),
  username text unique not null,
  display_name text,
  avatar_url text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- EQUIPOS GRAN DT
-- ============================================================
create table user_teams (
  id serial primary key,
  user_id uuid references profiles(id),
  formation text not null check (formation in ('4-4-2', '4-3-3', '3-5-2')),
  captain_player_id integer references players(id),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- JUGADORES DEL EQUIPO (11 slots)
create table user_team_players (
  id serial primary key,
  user_team_id integer references user_teams(id) on delete cascade,
  player_id integer references players(id),
  slot integer not null check (slot between 1 and 11),
  -- Slot 1 = GK
  -- Slots 2-5 = DEF (varía según formación)
  -- Slots 6-9 = MID (varía según formación)
  -- Slots 10-11 = FWD (varía según formación)
  unique(user_team_id, slot)
);

-- ============================================================
-- BALANCE DE CAMBIOS
-- ============================================================
create table user_transfer_balance (
  user_id uuid primary key references profiles(id),
  available integer default 0 check (available >= 0 and available <= 11),
  total_used integer default 0,
  last_updated timestamptz default now()
);

-- Trigger: crear perfil + balance automáticamente al registrarse
-- (definido DESPUÉS de que ambas tablas existan)
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  insert into public.user_transfer_balance (user_id, available, total_used)
  values (new.id, 0, 0);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- HISTORIAL DE TRANSFERENCIAS
-- ============================================================
create table transfers (
  id serial primary key,
  user_id uuid references profiles(id),
  player_out_id integer references players(id),
  player_in_id integer references players(id),
  match_id integer references matches(id),
  is_free boolean default false, -- true = sin costo (jugador inválido)
  transferred_at timestamptz default now()
);

-- ============================================================
-- PUNTOS POR JUGADOR POR PARTIDO
-- ============================================================
create table player_match_points (
  id serial primary key,
  player_id integer references players(id),
  match_id integer references matches(id),
  minutes_played integer default 0,
  goals integer default 0,
  assists integer default 0,
  yellow_cards integer default 0,
  red_card boolean default false,
  double_yellow boolean default false,
  own_goals integer default 0,
  clean_sheet boolean default false,
  is_mvp boolean default false,
  raw_points integer default 0,
  calculated_at timestamptz default now(),
  unique(player_id, match_id)
);

-- ============================================================
-- PUNTOS DE USUARIO POR PARTIDO
-- ============================================================
create table user_match_scores (
  id serial primary key,
  user_id uuid references profiles(id),
  match_id integer references matches(id),
  gran_dt_points integer default 0,
  captain_bonus integer default 0,
  prode_points integer default 0,
  total_points integer default 0,
  calculated_at timestamptz default now(),
  unique(user_id, match_id)
);

-- ============================================================
-- PREDICCIONES DEL PRODE
-- ============================================================
create table prode_predictions (
  id serial primary key,
  user_id uuid references profiles(id),
  match_id integer references matches(id),
  -- Fase de grupos
  pred_home_score integer,
  pred_away_score integer,
  -- Eliminatorias
  pred_winner_id integer references countries(id),
  pred_method text check (pred_method in ('90min', 'extra_time', 'penalties')),
  pred_score_method_home integer,
  pred_score_method_away integer,
  -- Resultado
  submitted_at timestamptz default now(),
  points_earned integer,
  evaluated boolean default false,
  unique(user_id, match_id)
);

-- ============================================================
-- LIGAS
-- ============================================================
create table leagues (
  id serial primary key,
  name text not null,
  invite_code text unique not null,
  created_by uuid references profiles(id),
  rules_text text,
  prizes_text text,
  created_at timestamptz default now()
);

create table league_members (
  id serial primary key,
  league_id integer references leagues(id) on delete cascade,
  user_id uuid references profiles(id),
  role text default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz default now(),
  unique(league_id, user_id)
);

-- ============================================================
-- VISTAS — RANKING
-- ============================================================

create or replace view global_ranking as
select
  p.id as user_id,
  p.username,
  p.display_name,
  coalesce(sum(s.gran_dt_points + s.captain_bonus), 0) as gran_dt_total,
  coalesce(sum(s.prode_points), 0) as prode_total,
  coalesce(sum(s.total_points), 0) as total_points,
  rank() over (order by coalesce(sum(s.total_points), 0) desc) as rank
from profiles p
left join user_match_scores s on s.user_id = p.id
group by p.id, p.username, p.display_name;

create or replace view league_ranking as
select
  lm.league_id,
  p.id as user_id,
  p.username,
  p.display_name,
  coalesce(sum(s.total_points), 0) as total_points,
  rank() over (
    partition by lm.league_id
    order by coalesce(sum(s.total_points), 0) desc
  ) as rank
from league_members lm
join profiles p on p.id = lm.user_id
left join user_match_scores s on s.user_id = lm.user_id
group by lm.league_id, p.id, p.username, p.display_name;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table user_teams enable row level security;
alter table user_team_players enable row level security;
alter table user_transfer_balance enable row level security;
alter table prode_predictions enable row level security;
alter table transfers enable row level security;
alter table user_match_scores enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;

-- Perfil
create policy "Perfil propio"
  on profiles for all
  using (auth.uid() = id);

-- Equipo Gran DT
create policy "Equipo propio"
  on user_teams for all
  using (auth.uid() = user_id);

create policy "Jugadores equipo propio"
  on user_team_players for all
  using (
    user_team_id in (
      select id from user_teams where user_id = auth.uid()
    )
  );

-- Cambios
create policy "Balance propio"
  on user_transfer_balance for all
  using (auth.uid() = user_id);

create policy "Transferencias propias"
  on transfers for all
  using (auth.uid() = user_id);

-- Predicciones (privadas)
create policy "Predicciones propias"
  on prode_predictions for all
  using (auth.uid() = user_id);

-- Puntos (solo propios — privacidad de equipos)
create policy "Solo puntos propios"
  on user_match_scores for select
  using (auth.uid() = user_id);

-- Ligas
create policy "Ver ligas propias"
  on leagues for select
  using (
    id in (
      select league_id from league_members where user_id = auth.uid()
    )
  );

create policy "Crear liga"
  on leagues for insert
  with check (auth.uid() = created_by);

create policy "Admin de liga puede editar"
  on leagues for update
  using (auth.uid() = created_by);

create policy "Ver miembros de liga propia"
  on league_members for select
  using (
    league_id in (
      select league_id from league_members where user_id = auth.uid()
    )
  );

create policy "Unirse a liga"
  on league_members for insert
  with check (auth.uid() = user_id);

-- Datos del torneo — lectura pública
create policy "Partidos públicos"    on matches         for select using (true);
create policy "Jugadores públicos"   on players         for select using (true);
create policy "Países públicos"      on countries       for select using (true);
create policy "Eventos públicos"     on match_events    for select using (true);
create policy "Puntos jugador públicos" on player_match_points for select using (true);
create policy "Fases públicas"       on phases          for select using (true);
