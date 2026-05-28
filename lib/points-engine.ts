/**
 * ProDT — Motor de puntos Gran DT
 *
 * Tabla de puntos:
 *   Gol (tiempo reglamentario)  +6
 *   Gol (tiempo extra)          +3
 *   Gol (penales/tanda)          0  ← no se trackea
 *   Asistencia (reglamentario)  +2
 *   Asistencia (tiempo extra)   +1
 *   Valla invicta               +4  (ARQ + DEF, >= 20 min, sin goles en 90+ET)
 *   MVP                         +5
 *   Gol en contra               -2  (por cada uno)
 *   Tarjeta amarilla            -2
 *   Tarjeta roja / doble AM     -4
 *
 * Reglas críticas:
 *   1. Capitán: raw_points * 2
 *   2. Doble amarilla: NO aplica -2 por yellow, solo -4 por roja
 *   3. Valla: solo si equipo NO recibió goles en 90 + T.extra
 *      Los penales NO rompen la valla
 *   4. Valla solo para GK y DEF con >= 20 minutos jugados
 */

import type { Position } from './formations'

// ── Tabla de puntos ───────────────────────────────────────────

const PTS = {
  goal_regular:    6,
  goal_extra_time: 3,
  // goal_penalty:  0 (no se trackea)
  assist_regular:    2,
  assist_extra_time: 1,
  clean_sheet:  4,
  mvp:          5,
  own_goal:    -2,
  yellow_card: -2,
  red_card:    -4,   // doble amarilla = -4 también
} as const

// ── Tipos de input ────────────────────────────────────────────

/**
 * Datos por jugador por partido, pre-procesados desde match_events.
 * El API /api/calculate-points construye este objeto para cada jugador.
 */
export interface PlayerMatchInput {
  player_id: number
  position: Position
  minutes_played: number

  // Goles (ya separados por momento)
  goals_regular: number       // goals con is_extra_time=false, no en tanda de penales
  goals_extra_time: number    // goals con is_extra_time=true

  // Asistencias
  assists_regular: number
  assists_extra_time: number

  // Tarjetas
  yellow_cards: number
  red_card: boolean
  double_yellow: boolean  // true → NO aplica yellow_card, solo red_card

  // Otros
  own_goals: number
  is_mvp: boolean

  // Valla invicta: true si el equipo NO recibió goles en 90 + T.extra
  // (los penales NO rompen la valla)
  clean_sheet: boolean
}

export interface PlayerMatchOutput {
  player_id: number
  raw_points: number
  breakdown: PointsBreakdown
}

export interface PointsBreakdown {
  goals_regular_pts: number
  goals_et_pts: number
  assists_regular_pts: number
  assists_et_pts: number
  clean_sheet_pts: number
  mvp_pts: number
  yellow_card_pts: number
  red_card_pts: number
  own_goal_pts: number
  subtotal: number
}

// ── Cálculo de puntos raw (sin capitán) ──────────────────────

export function calculateRawPoints(input: PlayerMatchInput): PlayerMatchOutput {
  const b: PointsBreakdown = {
    goals_regular_pts:    input.goals_regular    * PTS.goal_regular,
    goals_et_pts:         input.goals_extra_time * PTS.goal_extra_time,
    assists_regular_pts:  input.assists_regular  * PTS.assist_regular,
    assists_et_pts:       input.assists_extra_time * PTS.assist_extra_time,
    clean_sheet_pts: 0,
    mvp_pts: 0,
    yellow_card_pts: 0,
    red_card_pts: 0,
    own_goal_pts:    input.own_goals * PTS.own_goal,
    subtotal: 0,
  }

  // Tarjetas
  // Doble amarilla: solo -4 (roja), NO -2 por la amarilla
  if (input.double_yellow) {
    b.red_card_pts = PTS.red_card  // -4
    // b.yellow_card_pts queda en 0
  } else {
    b.yellow_card_pts = input.yellow_cards * PTS.yellow_card  // -2 c/u
    if (input.red_card) {
      b.red_card_pts = PTS.red_card  // -4
    }
  }

  // Valla invicta: ARQ o DEF, >= 20 min, equipo sin goles encajados
  if (
    input.clean_sheet &&
    input.minutes_played >= 20 &&
    (input.position === 'GK' || input.position === 'DEF')
  ) {
    b.clean_sheet_pts = PTS.clean_sheet  // +4
  }

  // MVP
  if (input.is_mvp) {
    b.mvp_pts = PTS.mvp  // +5
  }

  b.subtotal =
    b.goals_regular_pts +
    b.goals_et_pts +
    b.assists_regular_pts +
    b.assists_et_pts +
    b.clean_sheet_pts +
    b.mvp_pts +
    b.yellow_card_pts +
    b.red_card_pts +
    b.own_goal_pts

  return { player_id: input.player_id, raw_points: b.subtotal, breakdown: b }
}

// ── Puntos con capitán ────────────────────────────────────────

/**
 * Calcula los puntos de un jugador para un usuario,
 * aplicando el doble si es capitán.
 *
 * @returns { finalPoints, captainBonus }
 *   captainBonus = raw_points  (porque final = raw * 2 = raw + raw)
 */
export function calculateUserPlayerPoints(
  input: PlayerMatchInput,
  isCaptain: boolean
): { finalPoints: number; captainBonus: number } {
  const { raw_points } = calculateRawPoints(input)

  if (isCaptain) {
    return {
      finalPoints: raw_points * 2,
      captainBonus: raw_points,  // el "extra" que suma el capitanazgo
    }
  }

  return { finalPoints: raw_points, captainBonus: 0 }
}

// ── Suma total para un equipo ─────────────────────────────────

export interface TeamMatchResult {
  gran_dt_points: number  // sum of all raw_points (sin capitán)
  captain_bonus: number   // raw_points del capitán
  total_gran_dt: number   // gran_dt_points + captain_bonus
}

export function calculateTeamPoints(
  players: PlayerMatchInput[],
  captainPlayerId: number | null
): TeamMatchResult {
  let gran_dt_points = 0
  let captain_bonus = 0

  for (const player of players) {
    const isCaptain = player.player_id === captainPlayerId
    const { finalPoints, captainBonus } = calculateUserPlayerPoints(player, isCaptain)

    if (isCaptain) {
      // gran_dt incluye el raw, captain_bonus es el extra
      gran_dt_points += finalPoints - captainBonus
      captain_bonus = captainBonus
    } else {
      gran_dt_points += finalPoints
    }
  }

  return {
    gran_dt_points,
    captain_bonus,
    total_gran_dt: gran_dt_points + captain_bonus,
  }
}

// ── Helpers para el API route ─────────────────────────────────

/**
 * Determina si un equipo tiene valla invicta.
 * La valla es invicta si no recibió goles en tiempo reglamentario + tiempo extra.
 * Los penales (tanda) NO rompen la valla.
 *
 * @param goalsAgainst_90   goles recibidos en 90 min
 * @param goalsAgainst_et   goles recibidos en T.extra (0 si no hubo T.extra)
 */
export function isCleanSheet(
  goalsAgainst_90: number,
  goalsAgainst_et: number
): boolean {
  return goalsAgainst_90 === 0 && goalsAgainst_et === 0
}

/**
 * Determina el resultado de la valla para un equipo:
 * usa los goles recibidos (match.away_score para el equipo local, etc.)
 */
export function getTeamCleanSheet(
  teamCountryId: number,
  homeCountryId: number,
  awayCountryId: number,
  homeScore90: number,
  awayScore90: number,
  homeScoreEt: number | null,
  awayScoreEt: number | null
): boolean {
  let goalsAgainst90: number
  let goalsAgainstEt: number

  if (teamCountryId === homeCountryId) {
    goalsAgainst90 = awayScore90
    goalsAgainstEt = awayScoreEt ?? 0
  } else if (teamCountryId === awayCountryId) {
    goalsAgainst90 = homeScore90
    goalsAgainstEt = homeScoreEt ?? 0
  } else {
    return false // jugador no pertenece a ninguno de los dos equipos
  }

  return isCleanSheet(goalsAgainst90, goalsAgainstEt)
}
