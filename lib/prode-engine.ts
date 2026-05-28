/**
 * ProDT — Motor de evaluación del Prode
 *
 * Fase de grupos
 * ──────────────
 * El usuario predice: marcador exacto (home - away).
 *   • Marcador exacto:          +5 pts  (reemplaza al ganador, no acumula)
 *   • Ganador/empate correcto:  +2 pts
 *   • Falla todo:                0 pts
 *
 * Fases eliminatorias
 * ───────────────────
 * El usuario predice: ganador + método + marcador al momento del método.
 * Los puntos SÍ acumulan:
 *   • Ganador correcto:          +2 pts  (si falla, 0 y se corta)
 *   • + Método exacto:           +3 pts extra
 *   • + Marcador exacto:         +2 pts extra
 *   Máximo posible:               7 pts
 *
 * El marcador exacto en eliminatorias se evalúa sobre el momento del método:
 *   '90min'      → home_score_90  /  away_score_90
 *   'extra_time' → home_score_et  /  away_score_et
 *   'penalties'  → marcador al inicio de la tanda (= final del T. extra)
 */

import type { PredMethod, ProdePrediction } from './types'

// ── Tipos internos del motor ─────────────────────────────────

export interface MatchResultForProde {
  phase_order: number   // 1 = grupos; 2-5 = eliminatorias
  home_country_id: number
  away_country_id: number
  // Tiempo reglamentario (siempre presente si status = 'finished')
  home_score_90: number
  away_score_90: number
  // Tiempo extra (null si no hubo)
  home_score_et: number | null
  away_score_et: number | null
  went_to_et: boolean
  went_to_penalties: boolean
  // Ganador (null = empate en grupos)
  winner_country_id: number | null
}

// ── Helpers ──────────────────────────────────────────────────

type ResultOutcome = 'home' | 'away' | 'draw'

function groupResult(homeScore: number, awayScore: number): ResultOutcome {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'draw'
}

function knockoutMethod(match: MatchResultForProde): PredMethod {
  if (match.went_to_penalties) return 'penalties'
  if (match.went_to_et)        return 'extra_time'
  return '90min'
}

function scoreAtMethod(
  match: MatchResultForProde,
  method: PredMethod
): { home: number; away: number } | null {
  switch (method) {
    case '90min':
      return { home: match.home_score_90, away: match.away_score_90 }

    case 'extra_time':
      if (match.home_score_et === null || match.away_score_et === null) return null
      return { home: match.home_score_et, away: match.away_score_et }

    case 'penalties':
      // Marcador al inicio de los penales = final del tiempo extra (o reglamentario si no hubo T.extra)
      const h = match.home_score_et ?? match.home_score_90
      const a = match.away_score_et ?? match.away_score_90
      return { home: h, away: a }
  }
}

// ── Grupos ───────────────────────────────────────────────────

function calculateGroupPoints(
  match: MatchResultForProde,
  prediction: Pick<ProdePrediction, 'pred_home_score' | 'pred_away_score'>
): number {
  const { pred_home_score, pred_away_score } = prediction
  if (pred_home_score === null || pred_away_score === null) return 0

  // Marcador exacto → 5 pts (reemplaza, no acumula)
  if (
    pred_home_score === match.home_score_90 &&
    pred_away_score === match.away_score_90
  ) {
    return 5
  }

  // Solo resultado correcto → 2 pts
  const actualOutcome = groupResult(match.home_score_90, match.away_score_90)
  const predOutcome   = groupResult(pred_home_score, pred_away_score)
  if (actualOutcome === predOutcome) return 2

  return 0
}

// ── Eliminatorias ────────────────────────────────────────────

function calculateKnockoutPoints(
  match: MatchResultForProde,
  prediction: Pick<
    ProdePrediction,
    'pred_winner_id' | 'pred_method' | 'pred_score_method_home' | 'pred_score_method_away'
  >
): number {
  const { pred_winner_id, pred_method, pred_score_method_home, pred_score_method_away } = prediction

  // Sin predicción de ganador → 0
  if (!pred_winner_id || !match.winner_country_id) return 0

  // Ganador incorrecto → 0 (se corta aquí)
  if (pred_winner_id !== match.winner_country_id) return 0

  let points = 2 // ganador correcto

  // Verificar método
  const actualMethod = knockoutMethod(match)
  if (pred_method !== actualMethod) return points

  points += 3 // método correcto

  // Verificar marcador al momento del método predicho
  if (pred_score_method_home !== null && pred_score_method_away !== null && pred_method) {
    const actual = scoreAtMethod(match, pred_method)
    if (
      actual !== null &&
      pred_score_method_home === actual.home &&
      pred_score_method_away === actual.away
    ) {
      points += 2
    }
  }

  return points
}

// ── API pública ──────────────────────────────────────────────

/**
 * Calcula los puntos de Prode para una predicción dada.
 * Solo debe llamarse cuando `match.status === 'finished'`.
 */
export function calculateProdePoints(
  match: MatchResultForProde,
  prediction: ProdePrediction
): number {
  if (match.phase_order === 1) {
    return calculateGroupPoints(match, prediction)
  }
  return calculateKnockoutPoints(match, prediction)
}

/**
 * Devuelve el desglose de puntos para mostrar en la UI.
 */
export interface ProdePointsBreakdown {
  total: number
  winnerPoints: number   // 2 pts si ganador correcto (knockout) ó 2 pts si resultado correcto (grupos)
  exactPoints: number    // 5 pts (grupos) ó 2 pts (knockout) si marcador exacto
  methodPoints: number   // 3 pts si método correcto (knockout)
  label: string          // Descripción legible
}

export function calculateProdeBreakdown(
  match: MatchResultForProde,
  prediction: ProdePrediction
): ProdePointsBreakdown {
  const blank: ProdePointsBreakdown = { total: 0, winnerPoints: 0, exactPoints: 0, methodPoints: 0, label: 'Sin puntos' }

  if (match.phase_order === 1) {
    const { pred_home_score, pred_away_score } = prediction
    if (pred_home_score === null || pred_away_score === null) return blank

    if (pred_home_score === match.home_score_90 && pred_away_score === match.away_score_90) {
      return { total: 5, winnerPoints: 0, exactPoints: 5, methodPoints: 0, label: '¡Marcador exacto! +5' }
    }

    const correct = groupResult(match.home_score_90, match.away_score_90) === groupResult(pred_home_score, pred_away_score)
    if (correct) return { total: 2, winnerPoints: 2, exactPoints: 0, methodPoints: 0, label: 'Resultado correcto +2' }

    return blank
  }

  // Eliminatorias
  const { pred_winner_id, pred_method, pred_score_method_home, pred_score_method_away } = prediction
  if (!pred_winner_id || !match.winner_country_id) return blank
  if (pred_winner_id !== match.winner_country_id) return { ...blank, label: 'Ganador incorrecto' }

  let total = 2
  let label = 'Ganador correcto +2'

  const actualMethod = knockoutMethod(match)
  if (pred_method !== actualMethod) {
    return { total, winnerPoints: 2, exactPoints: 0, methodPoints: 0, label }
  }

  total += 3
  label = 'Ganador + método +5'

  if (pred_score_method_home !== null && pred_score_method_away !== null && pred_method) {
    const actual = scoreAtMethod(match, pred_method)
    if (actual && pred_score_method_home === actual.home && pred_score_method_away === actual.away) {
      total += 2
      label = '¡Perfecto! Ganador + método + marcador +7'
      return { total, winnerPoints: 2, exactPoints: 2, methodPoints: 3, label }
    }
  }

  return { total, winnerPoints: 2, exactPoints: 0, methodPoints: 3, label }
}
