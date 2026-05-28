// ── Entidades base ───────────────────────────────────────────

export type Phase = {
  id: number
  name: string
  phase_order: number
  max_per_country: number | null
  started_at: string | null
}

export type Country = {
  id: number
  name: string
  code: string
  flag_url: string | null
  eliminated: boolean
  eliminated_at: string | null
}

export type Player = {
  id: number
  api_football_id: number | null
  name: string
  country_id: number
  country?: Country
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  is_provisional: boolean
  is_active: boolean
  created_at: string
}

// ── Partido ──────────────────────────────────────────────────

export type MatchStatus = 'scheduled' | 'live' | 'finished'

export type Match = {
  id: number
  api_football_id: number | null
  phase_id: number
  phase: Phase
  home_country_id: number | null
  away_country_id: number | null
  home_country: Country | null
  away_country: Country | null
  kickoff_at: string
  status: MatchStatus
  home_score_90: number | null
  away_score_90: number | null
  home_score_et: number | null
  away_score_et: number | null
  went_to_et: boolean
  went_to_penalties: boolean
  winner_country_id: number | null
  mvp_player_id: number | null
  points_published: boolean
}

// ── Prode ────────────────────────────────────────────────────

export type PredMethod = '90min' | 'extra_time' | 'penalties'

export type ProdePrediction = {
  id: number
  user_id: string
  match_id: number
  // Fase de grupos
  pred_home_score: number | null
  pred_away_score: number | null
  // Eliminatorias
  pred_winner_id: number | null
  pred_method: PredMethod | null
  pred_score_method_home: number | null
  pred_score_method_away: number | null
  // Resultado
  submitted_at: string
  points_earned: number | null
  evaluated: boolean
}

// ── Inputs para server actions ───────────────────────────────

export type GroupPredictionInput = {
  type: 'group'
  matchId: number
  homeScore: number
  awayScore: number
}

export type KnockoutPredictionInput = {
  type: 'knockout'
  matchId: number
  winnerId: number
  method: PredMethod
  homeScore: number | null
  awayScore: number | null
}

export type PredictionInput = GroupPredictionInput | KnockoutPredictionInput

// ── Gran DT ──────────────────────────────────────────────────

export type Formation = '4-4-2' | '4-3-3' | '3-5-2'

export type UserTeam = {
  id: number
  user_id: string
  formation: Formation
  captain_player_id: number | null
  updated_at: string
}

export type UserTeamPlayer = {
  id: number
  user_team_id: number
  player_id: number
  player?: Player
  slot: number
}

// ── Puntos ───────────────────────────────────────────────────

export type PlayerMatchPoints = {
  id: number
  player_id: number
  match_id: number
  minutes_played: number
  goals: number
  assists: number
  yellow_cards: number
  red_card: boolean
  double_yellow: boolean
  own_goals: number
  clean_sheet: boolean
  is_mvp: boolean
  raw_points: number
  calculated_at: string
}

export type UserMatchScore = {
  id: number
  user_id: string
  match_id: number
  gran_dt_points: number
  captain_bonus: number
  prode_points: number
  total_points: number
  calculated_at: string
}

// ── Liga ─────────────────────────────────────────────────────

export type League = {
  id: number
  name: string
  invite_code: string
  created_by: string
  rules_text: string | null
  prizes_text: string | null
  created_at: string
}

export type LeagueMember = {
  id: number
  league_id: number
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
}

// ── Ranking ──────────────────────────────────────────────────

export type GlobalRankingRow = {
  user_id: string
  username: string
  display_name: string | null
  gran_dt_total: number
  prode_total: number
  total_points: number
  rank: number
}

// ── Perfil ───────────────────────────────────────────────────

export type Profile = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  is_admin: boolean
  created_at: string
}
