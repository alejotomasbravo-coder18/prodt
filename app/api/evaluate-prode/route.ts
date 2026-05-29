import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateProdePoints } from '@/lib/prode-engine'
import type { MatchResultForProde } from '@/lib/prode-engine'
import type { ProdePrediction } from '@/lib/types'

/**
 * POST /api/evaluate-prode?match_id=X
 *
 * Evalúa las predicciones del Prode para un partido específico.
 * Normalmente se llama desde runPublishPoints(), pero está disponible
 * como endpoint independiente para re-evaluaciones.
 *
 * Requiere: Authorization: Bearer CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const matchIdStr = searchParams.get('match_id')

  if (!matchIdStr) {
    return NextResponse.json({ error: 'match_id es requerido.' }, { status: 400 })
  }

  const matchId = parseInt(matchIdStr)
  const supabase = createServiceClient()

  // Cargar partido
  const { data: match } = await supabase
    .from('matches')
    .select(`
      id, phase_id,
      home_score_90, away_score_90,
      home_score_et, away_score_et,
      went_to_et, went_to_penalties,
      winner_country_id,
      home_country_id, away_country_id,
      phase:phases (phase_order)
    `)
    .eq('id', matchId)
    .single()

  if (!match) {
    return NextResponse.json({ error: 'Partido no encontrado.' }, { status: 404 })
  }

  // Predicciones no evaluadas
  const { data: predictions } = await supabase
    .from('prode_predictions')
    .select('*')
    .eq('match_id', matchId)
    .eq('evaluated', false)

  if (!predictions || predictions.length === 0) {
    return NextResponse.json({ success: true, evaluated: 0, message: 'No hay predicciones pendientes.' })
  }

  const phaseOrder = (match.phase as unknown as { phase_order: number } | null)?.phase_order ?? 1

  const matchResult: MatchResultForProde = {
    phase_order: phaseOrder,
    home_score_90: match.home_score_90,
    away_score_90: match.away_score_90,
    home_score_et: match.home_score_et,
    away_score_et: match.away_score_et,
    went_to_et: match.went_to_et ?? false,
    went_to_penalties: match.went_to_penalties ?? false,
    winner_country_id: match.winner_country_id,
    home_country_id: match.home_country_id,
    away_country_id: match.away_country_id,
  }

  let evaluated = 0
  for (const pred of predictions) {
    const points = calculateProdePoints(matchResult, pred as ProdePrediction)

    await supabase
      .from('prode_predictions')
      .update({ points_earned: points, evaluated: true })
      .eq('id', pred.id)

    // Actualizar user_match_scores
    await supabase
      .from('user_match_scores')
      .upsert(
        {
          user_id: pred.user_id,
          match_id: matchId,
          prode_points: points,
          total_points: points,
        },
        {
          onConflict: 'user_id,match_id',
          ignoreDuplicates: false,
        }
      )

    evaluated++
  }

  return NextResponse.json({
    success: true,
    evaluated,
    message: `${evaluated} predicciones evaluadas.`,
  })
}
