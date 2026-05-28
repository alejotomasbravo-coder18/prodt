'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PredictionInput } from '@/lib/types'

export interface ActionResult {
  error?: string
  success?: boolean
}

/**
 * Guarda o actualiza la predicción de un usuario para un partido.
 *
 * Validaciones:
 *   1. Usuario autenticado
 *   2. Partido existe y no está cancelado
 *   3. Deadline no pasó (kickoff_at > now())
 *   4. Datos completos según la fase (grupo vs eliminatoria)
 */
export async function submitPrediction(
  data: PredictionInput
): Promise<ActionResult> {
  const supabase = await createClient()

  // ── 1. Auth ──────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Tenés que estar logueado para predecir.' }

  // ── 2. Obtener partido ───────────────────────────────────
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select(
      'id, kickoff_at, status, phase:phases(phase_order), home_country_id, away_country_id'
    )
    .eq('id', data.matchId)
    .single()

  if (matchError || !match) {
    return { error: 'Partido no encontrado.' }
  }

  if (!match.home_country_id || !match.away_country_id) {
    return { error: 'Los equipos de este partido todavía no están definidos.' }
  }

  // ── 3. Deadline ──────────────────────────────────────────
  const now = new Date()
  const kickoff = new Date(match.kickoff_at)

  if (kickoff <= now) {
    return { error: 'Deadline cerrado. El partido ya comenzó.' }
  }

  const phase = match.phase as { phase_order: number } | null
  const phaseOrder = phase?.phase_order ?? 1

  // ── 4. Validar inputs según fase ─────────────────────────
  if (phaseOrder === 1) {
    // Fase de grupos
    if (data.type !== 'group') {
      return { error: 'Predicción inválida para fase de grupos.' }
    }
    if (
      typeof data.homeScore !== 'number' ||
      typeof data.awayScore !== 'number' ||
      data.homeScore < 0 ||
      data.awayScore < 0 ||
      data.homeScore > 20 ||
      data.awayScore > 20
    ) {
      return { error: 'Marcador inválido.' }
    }
  } else {
    // Eliminatorias
    if (data.type !== 'knockout') {
      return { error: 'Predicción inválida para eliminatoria.' }
    }
    if (!data.winnerId) {
      return { error: 'Seleccioná un ganador.' }
    }
    if (!['90min', 'extra_time', 'penalties'].includes(data.method)) {
      return { error: 'Método de victoria inválido.' }
    }
    // El ganador debe ser uno de los dos equipos del partido
    if (
      data.winnerId !== match.home_country_id &&
      data.winnerId !== match.away_country_id
    ) {
      return { error: 'El ganador debe ser uno de los dos equipos.' }
    }
    // Validar marcador opcional
    if (
      data.homeScore !== null &&
      data.awayScore !== null &&
      (data.homeScore < 0 || data.awayScore < 0 || data.homeScore > 20 || data.awayScore > 20)
    ) {
      return { error: 'Marcador inválido.' }
    }
  }

  // ── 5. Construir payload ─────────────────────────────────
  const basePayload = {
    user_id: user.id,
    match_id: data.matchId,
    submitted_at: new Date().toISOString(),
    evaluated: false,
    points_earned: null as null,
  }

  const payload =
    data.type === 'group'
      ? {
          ...basePayload,
          pred_home_score: data.homeScore,
          pred_away_score: data.awayScore,
          pred_winner_id: null,
          pred_method: null,
          pred_score_method_home: null,
          pred_score_method_away: null,
        }
      : {
          ...basePayload,
          pred_home_score: null,
          pred_away_score: null,
          pred_winner_id: data.winnerId,
          pred_method: data.method,
          pred_score_method_home: data.homeScore ?? null,
          pred_score_method_away: data.awayScore ?? null,
        }

  // ── 6. Upsert ────────────────────────────────────────────
  const { error: upsertError } = await supabase
    .from('prode_predictions')
    .upsert(payload, { onConflict: 'user_id,match_id' })

  if (upsertError) {
    console.error('Prode upsert error:', upsertError)
    return { error: 'Error al guardar la predicción. Intentá de nuevo.' }
  }

  revalidatePath('/prode')
  return { success: true }
}

/**
 * Elimina la predicción de un usuario para un partido
 * (solo si el deadline no pasó).
 */
export async function deletePrediction(matchId: number): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'No autenticado.' }

  // Verificar deadline
  const { data: match } = await supabase
    .from('matches')
    .select('kickoff_at')
    .eq('id', matchId)
    .single()

  if (!match) return { error: 'Partido no encontrado.' }
  if (new Date(match.kickoff_at) <= new Date()) {
    return { error: 'Deadline cerrado.' }
  }

  const { error } = await supabase
    .from('prode_predictions')
    .delete()
    .eq('user_id', user.id)
    .eq('match_id', matchId)

  if (error) return { error: 'Error al eliminar la predicción.' }

  revalidatePath('/prode')
  return { success: true }
}
