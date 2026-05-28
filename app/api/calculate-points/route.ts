import { NextRequest, NextResponse } from 'next/server'
import { runPublishPoints } from '@/app/actions/admin'

/**
 * POST /api/calculate-points?match_id=X
 *
 * Calcula y publica los puntos de un partido.
 * Requiere el header Authorization: Bearer CRON_SECRET
 * o ser llamado por un admin desde el panel.
 *
 * También puede usarse directamente desde /admin/publicar (que usa la Server Action).
 * Este endpoint es para integraciones externas o scripts.
 */
export async function POST(request: NextRequest) {
  // Verificar secret
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
  if (isNaN(matchId)) {
    return NextResponse.json({ error: 'match_id inválido.' }, { status: 400 })
  }

  try {
    const result = await runPublishPoints(matchId)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      matchId,
    })
  } catch (err) {
    console.error('[calculate-points] Error:', err)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
