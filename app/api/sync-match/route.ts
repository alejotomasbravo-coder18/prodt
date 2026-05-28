import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/sync-match
 *
 * Cron job que se ejecuta cada 30 minutos (configurado en vercel.json).
 * Busca partidos que hayan terminado recientemente y sincroniza
 * su resultado desde API-Football.
 *
 * Flujo:
 * 1. Buscar partidos con status='live' o 'scheduled' y kickoff <= hace 2h
 * 2. Consultar API-Football para cada uno
 * 3. Si el partido terminó → actualizar status, marcador, etc.
 * 4. Los eventos los carga el admin manualmente (la API gratuita es limitada)
 *
 * Requiere: Authorization: Bearer CRON_SECRET
 * (Vercel envía este header automáticamente en cron jobs si está configurado)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API_FOOTBALL_KEY no configurada.' }, { status: 500 })
  }

  const supabase = createServiceClient()

  // Partidos que podrían haber terminado: live o scheduled con kickoff <= hace 130 min
  const cutoff = new Date(Date.now() - 130 * 60 * 1000).toISOString()

  const { data: matches } = await supabase
    .from('matches')
    .select('id, api_football_id, status, kickoff_at')
    .in('status', ['live', 'scheduled'])
    .not('api_football_id', 'is', null)
    .lte('kickoff_at', cutoff)
    .limit(10) // máx 10 por cron para no agotar el rate limit

  if (!matches || matches.length === 0) {
    return NextResponse.json({ success: true, synced: 0, message: 'No hay partidos para sincronizar.' })
  }

  let synced = 0
  const errors: string[] = []

  for (const match of matches) {
    try {
      const res = await fetch(
        `https://v3.football.api-sports.io/fixtures?id=${match.api_football_id}`,
        {
          headers: {
            'x-apisports-key': apiKey,
          },
          cache: 'no-store',
        }
      )

      if (!res.ok) {
        errors.push(`Partido ${match.id}: HTTP ${res.status}`)
        continue
      }

      const json = await res.json()
      const fixture = json?.response?.[0]

      if (!fixture) {
        errors.push(`Partido ${match.id}: sin datos en API-Football`)
        continue
      }

      const fixtureStatus = fixture.fixture?.status?.short
      const goals = fixture.goals
      const score = fixture.score

      // Determinar status interno
      let newStatus: 'scheduled' | 'live' | 'finished' = match.status
      if (['FT', 'AET', 'PEN', 'WO'].includes(fixtureStatus)) {
        newStatus = 'finished'
      } else if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(fixtureStatus)) {
        newStatus = 'live'
      }

      if (newStatus === match.status) continue // sin cambios

      // Parsear marcador
      const homeScore90 = goals?.home ?? null
      const awayScore90 = goals?.away ?? null
      const wentToEt = ['AET', 'PEN'].includes(fixtureStatus)
      const wentToPenalties = fixtureStatus === 'PEN'

      const homeScoreEt = wentToEt ? (score?.extratime?.home ?? homeScore90) : null
      const awayScoreEt = wentToEt ? (score?.extratime?.away ?? awayScore90) : null

      // Ganador
      let winnerCode: string | null = null
      if (newStatus === 'finished') {
        const homeGoals = homeScoreEt ?? homeScore90 ?? 0
        const awayGoals = awayScoreEt ?? awayScore90 ?? 0
        if (wentToPenalties) {
          // En penales el "winner" viene del fixture
          winnerCode = fixture.teams?.home?.winner === true
            ? fixture.teams?.home?.name
            : fixture.teams?.away?.name
        } else if (homeGoals > awayGoals) {
          winnerCode = 'home'
        } else if (awayGoals > homeGoals) {
          winnerCode = 'away'
        }
      }

      // Actualizar en Supabase
      const updatePayload: Record<string, unknown> = {
        status: newStatus,
        home_score_90: homeScore90,
        away_score_90: awayScore90,
        went_to_et: wentToEt,
        went_to_penalties: wentToPenalties,
      }

      if (wentToEt) {
        updatePayload.home_score_et = homeScoreEt
        updatePayload.away_score_et = awayScoreEt
      }

      // Resolver winner_country_id si es home/away
      if (winnerCode === 'home' || winnerCode === 'away') {
        const { data: matchRow } = await supabase
          .from('matches')
          .select('home_country_id, away_country_id')
          .eq('id', match.id)
          .single()

        if (matchRow) {
          updatePayload.winner_country_id =
            winnerCode === 'home' ? matchRow.home_country_id : matchRow.away_country_id
        }
      }

      await supabase.from('matches').update(updatePayload).eq('id', match.id)

      synced++
    } catch (err) {
      errors.push(`Partido ${match.id}: ${String(err)}`)
    }
  }

  return NextResponse.json({
    success: true,
    synced,
    errors: errors.length > 0 ? errors : undefined,
    message: `${synced} partido${synced !== 1 ? 's' : ''} sincronizado${synced !== 1 ? 's' : ''}.`,
  })
}
