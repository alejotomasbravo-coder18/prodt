'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calculateRawPoints } from '@/lib/points-engine'
import { calculateProdePoints } from '@/lib/prode-engine'
import { SUBSTITUTE_SLOT } from '@/lib/formations'
import type { PlayerMatchInput } from '@/lib/points-engine'
import type { MatchResultForProde } from '@/lib/prode-engine'
import type { ProdePrediction } from '@/lib/types'
import type { Position } from '@/lib/formations'

export interface AdminActionResult {
  error?: string
  success?: boolean
  message?: string
}

// ── Guard de admin ─────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.', supabase: null, user: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return { error: 'Sin permisos de admin.', supabase: null, user: null }

  return { error: null, supabase, user }
}

// ── Actualizar estado de partido ───────────────────────────

export async function updateMatchStatus(
  matchId: number,
  status: 'scheduled' | 'live' | 'finished',
  homeScore90?: number,
  awayScore90?: number,
  homeScoreEt?: number,
  awayScoreEt?: number,
  wentToEt?: boolean,
  wentToPenalties?: boolean,
  winnerCountryId?: number | null
): Promise<AdminActionResult> {
  const { error, supabase } = await requireAdmin()
  if (error || !supabase) return { error: error ?? 'Error de autenticación.' }

  await supabase
    .from('matches')
    .update({
      status,
      home_score_90: homeScore90 ?? null,
      away_score_90: awayScore90 ?? null,
      home_score_et: homeScoreEt ?? null,
      away_score_et: awayScoreEt ?? null,
      went_to_et: wentToEt ?? false,
      went_to_penalties: wentToPenalties ?? false,
      winner_country_id: winnerCountryId ?? null,
    })
    .eq('id', matchId)

  revalidatePath('/admin/partidos')
  revalidatePath('/prode')
  return { success: true, message: 'Partido actualizado.' }
}

// ── Asignar MVP ────────────────────────────────────────────

export async function setMvp(
  matchId: number,
  playerId: number | null
): Promise<AdminActionResult> {
  const { error, supabase } = await requireAdmin()
  if (error || !supabase) return { error: error ?? 'Error de autenticación.' }

  await supabase
    .from('matches')
    .update({ mvp_player_id: playerId })
    .eq('id', matchId)

  // Si se asigna MVP, crear/actualizar evento de tipo 'mvp'
  if (playerId) {
    // Borrar evento mvp previo si existe
    await supabase
      .from('match_events')
      .delete()
      .eq('match_id', matchId)
      .eq('event_type', 'mvp')

    await supabase.from('match_events').insert({
      match_id: matchId,
      player_id: playerId,
      event_type: 'mvp',
    })
  } else {
    await supabase
      .from('match_events')
      .delete()
      .eq('match_id', matchId)
      .eq('event_type', 'mvp')
  }

  revalidatePath('/admin/partidos')
  return { success: true, message: 'MVP asignado.' }
}

// ── Agregar evento de partido ──────────────────────────────

export async function addMatchEvent(formData: FormData): Promise<AdminActionResult> {
  const { error, supabase } = await requireAdmin()
  if (error || !supabase) return { error: error ?? 'Error de autenticación.' }

  const matchId = parseInt(formData.get('match_id') as string)
  const playerId = parseInt(formData.get('player_id') as string)
  const eventType = formData.get('event_type') as string
  const minute = formData.get('minute') ? parseInt(formData.get('minute') as string) : null
  const isExtraTime = formData.get('is_extra_time') === 'true'

  if (!matchId || !playerId || !eventType) {
    return { error: 'Faltan campos requeridos.' }
  }

  await supabase.from('match_events').insert({
    match_id: matchId,
    player_id: playerId,
    event_type: eventType,
    minute,
    is_extra_time: isExtraTime,
  })

  revalidatePath('/admin/eventos')
  return { success: true, message: 'Evento agregado.' }
}

// ── Eliminar evento ────────────────────────────────────────

export async function deleteMatchEvent(eventId: number): Promise<AdminActionResult> {
  const { error, supabase } = await requireAdmin()
  if (error || !supabase) return { error: error ?? 'Error de autenticación.' }

  await supabase.from('match_events').delete().eq('id', eventId)

  revalidatePath('/admin/eventos')
  return { success: true }
}

// ── PUBLICAR PUNTOS ────────────────────────────────────────
//
// Flujo completo:
// 1. Leer eventos del partido → calcular player_match_points
// 2. Para cada usuario con jugadores del partido → calcular user_match_scores
// 3. Evaluar prode_predictions del partido
// 4. Ganador de fecha en cada liga → +1 cambio
// 5. matches.points_published = true
//
// Esta acción también se llama desde /api/calculate-points

export async function publishPoints(matchId: number): Promise<AdminActionResult> {
  const { error } = await requireAdmin()
  if (error) return { error }

  return runPublishPoints(matchId)
}

// Función interna (también usada por el API route con service role)
export async function runPublishPoints(matchId: number): Promise<AdminActionResult> {
  const supabase = createServiceClient()

  // 1. Cargar partido
  const { data: match } = await supabase
    .from('matches')
    .select(`
      id, status, phase_id,
      home_score_90, away_score_90,
      home_score_et, away_score_et,
      went_to_et, went_to_penalties,
      winner_country_id,
      home_country_id, away_country_id,
      points_published
    `)
    .eq('id', matchId)
    .single()

  if (!match) return { error: 'Partido no encontrado.' }
  if (match.points_published) return { error: 'Los puntos ya fueron publicados.' }
  if (match.status !== 'finished') return { error: 'El partido no está finalizado.' }

  // 2. Cargar eventos del partido
  const { data: events } = await supabase
    .from('match_events')
    .select('player_id, event_type, minute, is_extra_time')
    .eq('match_id', matchId)
    .eq('is_overridden', false)

  // 3. Agrupar eventos por jugador
  const playerEventsMap = new Map<
    number,
    {
      goals: number
      goals_et: number
      assists: number
      assists_et: number
      yellow_cards: number
      red_card: boolean
      double_yellow: boolean
      own_goals: number
      is_mvp: boolean
      clean_sheet: boolean
    }
  >()

  function getOrCreate(playerId: number) {
    if (!playerEventsMap.has(playerId)) {
      playerEventsMap.set(playerId, {
        goals: 0, goals_et: 0, assists: 0, assists_et: 0,
        yellow_cards: 0, red_card: false, double_yellow: false,
        own_goals: 0, is_mvp: false, clean_sheet: false,
      })
    }
    return playerEventsMap.get(playerId)!
  }

  const homeGoals90 = match.home_score_90 ?? 0
  const awayGoals90 = match.away_score_90 ?? 0
  const homeGoalsEt = match.home_score_et ?? homeGoals90
  const awayGoalsEt = match.away_score_et ?? awayGoals90

  // Jugadores que el admin marcó explícitamente como "no jugó"
  const didNotPlayIds = new Set<number>()

  for (const ev of events ?? []) {
    if (ev.event_type === 'did_not_play') {
      didNotPlayIds.add(ev.player_id)
      continue
    }
    const p = getOrCreate(ev.player_id)
    switch (ev.event_type) {
      case 'goal':
        if (ev.is_extra_time) p.goals_et++
        else p.goals++
        break
      case 'assist':
        if (ev.is_extra_time) p.assists_et++
        else p.assists++
        break
      case 'yellow_card':
        p.yellow_cards++
        if (p.yellow_cards >= 2) p.double_yellow = true
        break
      case 'red_card':
        p.red_card = true
        break
      case 'own_goal':
        p.own_goals++
        break
      case 'mvp':
        p.is_mvp = true
        break
    }
  }

  // 4. Calcular valla invicta por equipo
  // Para eso necesitamos saber qué jugadores son del home/away team
  // Usaremos el country_id de los jugadores
  const homeCleanSheet = awayGoalsEt === 0  // Home no recibió goles
  const awayCleanSheet = homeGoalsEt === 0  // Away no recibió goles

  // Cargar jugadores de ambos equipos para saber de qué país son
  const { data: playersInMatch } = await supabase
    .from('players')
    .select('id, country_id, position')
    .in('country_id', [match.home_country_id, match.away_country_id])
    .eq('is_active', true)

  const playerCountryMap = new Map(
    (playersInMatch ?? []).map((p) => [p.id, { countryId: p.country_id, position: p.position }])
  )

  // 5. Asignar clean_sheet y calcular raw_points
  const playerPointsToInsert: {
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
  }[] = []

  for (const [playerId, ev] of Array.from(playerEventsMap.entries())) {
    const info = playerCountryMap.get(playerId) as { countryId: number; position: string } | undefined
    const countryId = info?.countryId
    const position = info?.position ?? 'FWD'

    // Valla invicta: solo GK y DEF, y el equipo no recibió goles
    let cleanSheet = false
    if (position === 'GK' || position === 'DEF') {
      if (countryId === match.home_country_id && homeCleanSheet) cleanSheet = true
      if (countryId === match.away_country_id && awayCleanSheet) cleanSheet = true
    }
    ev.clean_sheet = cleanSheet

    const input: PlayerMatchInput = {
      player_id: playerId,
      position: position as 'GK' | 'DEF' | 'MID' | 'FWD',
      minutes_played: 90, // simplificado: asumimos que jugó si tiene eventos
      goals_regular: ev.goals,
      goals_extra_time: ev.goals_et,
      assists_regular: ev.assists,
      assists_extra_time: ev.assists_et,
      yellow_cards: ev.yellow_cards,
      red_card: ev.red_card,
      double_yellow: ev.double_yellow,
      own_goals: ev.own_goals,
      clean_sheet: ev.clean_sheet,
      is_mvp: ev.is_mvp,
    }

    const output = calculateRawPoints(input)

    playerPointsToInsert.push({
      player_id: playerId,
      match_id: matchId,
      minutes_played: 90,
      goals: ev.goals + ev.goals_et,
      assists: ev.assists + ev.assists_et,
      yellow_cards: ev.yellow_cards,
      red_card: ev.red_card,
      double_yellow: ev.double_yellow,
      own_goals: ev.own_goals,
      clean_sheet: ev.clean_sheet,
      is_mvp: ev.is_mvp,
      raw_points: output.raw_points,
    })
  }

  // Upsert player_match_points
  if (playerPointsToInsert.length > 0) {
    await supabase
      .from('player_match_points')
      .upsert(playerPointsToInsert as any, { onConflict: 'player_id,match_id' })
  }

  // 6. Para cada usuario con equipo → calcular user_match_scores
  const { data: allTeams } = await supabase
    .from('user_teams')
    .select('id, user_id, captain_player_id')

  const allUserScores: {
    user_id: string
    match_id: number
    gran_dt_points: number
    captain_bonus: number
    prode_points: number
    total_points: number
  }[] = []

  for (const team of allTeams ?? []) {
    // Obtener titulares Y suplentes del equipo (slots 1-15)
    const { data: teamPlayers } = await supabase
      .from('user_team_players')
      .select('player_id, slot')
      .eq('user_team_id', team.id)

    // Mapear slot → player_id para resolver sustituciones
    const slotToPlayer = new Map<number, number>()
    for (const tp of teamPlayers ?? []) {
      if (tp.player_id) slotToPlayer.set(tp.slot, tp.player_id)
    }

    let granDtPoints = 0
    let captainBonus = 0

    // Solo procesar titulares (slots 1-11)
    const starters = (teamPlayers ?? []).filter((tp) => tp.slot >= 1 && tp.slot <= 11)

    for (const { player_id, slot } of starters) {
      if (!player_id) continue

      // Determinar quién aporta puntos: titular o suplente
      let effectivePlayerId = player_id
      let substitutedIn = false

      if (didNotPlayIds.has(player_id)) {
        // El titular no jugó → buscar suplente de la misma posición
        const starterPosition = (playerCountryMap.get(player_id) as { countryId: number; position: string } | undefined)?.position as Position | undefined
        if (starterPosition) {
          const subSlot = SUBSTITUTE_SLOT[starterPosition]
          const subPlayerId = slotToPlayer.get(subSlot)
          if (subPlayerId && !didNotPlayIds.has(subPlayerId)) {
            effectivePlayerId = subPlayerId
            substitutedIn = true
          } else {
            // No hay suplente o el suplente tampoco jugó → 0 pts
            continue
          }
        } else {
          continue
        }
      }

      const rawEntry = playerPointsToInsert.find((p) => p.player_id === effectivePlayerId)
      const rawPoints = rawEntry?.raw_points ?? 0

      // El capitán aplica al jugador efectivo (titular o suplente que entró)
      const isCaptain = !substitutedIn && player_id === team.captain_player_id

      if (isCaptain) {
        granDtPoints += rawPoints * 2
        captainBonus += rawPoints
      } else {
        granDtPoints += rawPoints
      }
    }

    // Prode points para este partido se calculan después
    allUserScores.push({
      user_id: team.user_id,
      match_id: matchId,
      gran_dt_points: granDtPoints,
      captain_bonus: captainBonus,
      prode_points: 0, // se actualiza abajo
      total_points: granDtPoints,
    })
  }

  // 7. Evaluar predicciones del Prode
  const { data: predictions } = await supabase
    .from('prode_predictions')
    .select('*')
    .eq('match_id', matchId)
    .eq('evaluated', false)

  const matchResult: MatchResultForProde = { phase_order: match.phase?.phase_order ?? 1,
    
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

  const prodePointsByUser = new Map<string, number>()

  for (const pred of predictions ?? []) {
    const prodePoints = calculateProdePoints(matchResult, pred as ProdePrediction)
    prodePointsByUser.set(pred.user_id, prodePoints)

    await supabase
      .from('prode_predictions')
      .update({ points_earned: prodePoints, evaluated: true })
      .eq('id', pred.id)
  }

  // 8. Actualizar user_match_scores con prode points
  for (const score of allUserScores) {
    const prodePoints = prodePointsByUser.get(score.user_id) ?? 0
    score.prode_points = prodePoints
    score.total_points = score.gran_dt_points + prodePoints
  }

  if (allUserScores.length > 0) {
    await supabase
      .from('user_match_scores')
      .upsert(allUserScores as any, { onConflict: 'user_id,match_id' })
  }

  // 9. Ganador de fecha en ligas privadas → +1 cambio
  await awardMatchWinnersInLeagues(matchId, allUserScores)

  // 10. Marcar como publicado
  await supabase
    .from('matches')
    .update({ points_published: true })
    .eq('id', matchId)

  revalidatePath('/admin/publicar')
  revalidatePath('/ranking')
  revalidatePath('/gran-dt')
  revalidatePath('/dashboard')

  return {
    success: true,
    message: `Puntos publicados. ${allUserScores.length} usuarios actualizados.`,
  }
}

// ── Ganador de fecha en liga privada ───────────────────────

async function awardMatchWinnersInLeagues(
  matchId: number,
  userScores: { user_id: string; total_points: number }[]
) {
  const supabase = createServiceClient()

  if (userScores.length === 0) return

  // Obtener todas las ligas activas
  const { data: leagues } = await supabase
    .from('leagues')
    .select('id')

  for (const league of leagues ?? []) {
    // Miembros de la liga
    const { data: members } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', league.id)

    const memberIds = new Set((members ?? []).map((m) => m.user_id))

    // Puntos de los miembros en este partido
    const memberScores = userScores.filter((s) => memberIds.has(s.user_id))
    if (memberScores.length === 0) continue

    const maxPoints = Math.max(...memberScores.map((s) => s.total_points))
    if (maxPoints <= 0) continue

    const winners = memberScores.filter((s) => s.total_points === maxPoints)

    // Sumar +1 cambio a los ganadores (respetando tope de 11)
    for (const winner of winners) {
      const { data: balance } = await supabase
        .from('user_transfer_balance')
        .select('available')
        .eq('user_id', winner.user_id)
        .single()

      const current = balance?.available ?? 0
      if (current < 11) {
        await supabase
          .from('user_transfer_balance')
          .update({ available: current + 1, last_updated: new Date().toISOString() })
          .eq('user_id', winner.user_id)
      }
    }
  }
}

// ── Fin del torneo → Gran Campeón ──────────────────────────

export async function markTournamentEnd(): Promise<AdminActionResult> {
  await requireAdmin()
  const supa = createServiceClient()

  // 1. Buscar el #1 global
  const { data: topGlobal, error: globalErr } = await supa
    .from('global_ranking')
    .select('user_id')
    .order('rank', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (globalErr) return { error: 'Error al leer ranking global.' }

  if (topGlobal) {
    await supa
      .from('profiles')
      .update({ is_global_champion: true })
      .eq('id', topGlobal.user_id)

    // Notificación para el campeón global
    await supa.from('user_notifications').insert({
      user_id: topGlobal.user_id,
      type: 'champion',
      message: '🏆 ¡Sos el Gran Campeón del Mundial 2026!',
      metadata: { type: 'global' },
    })
  }

  // 2. Para cada liga: marcar al #1
  const { data: leagues } = await supa
    .from('leagues')
    .select('id, name')

  for (const league of leagues ?? []) {
    const { data: topLeague } = await supa
      .from('league_ranking')
      .select('user_id')
      .eq('league_id', league.id)
      .order('rank', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (topLeague) {
      await supa
        .from('league_members')
        .update({ is_league_champion: true })
        .eq('league_id', league.id)
        .eq('user_id', topLeague.user_id)

      await supa.from('user_notifications').insert({
        user_id: topLeague.user_id,
        type: 'champion',
        message: `🥇 ¡Sos el Campeón de la liga "${league.name}"!`,
        metadata: { type: 'league', league_id: league.id, league_name: league.name },
      })
    }
  }

  revalidatePath('/ranking')
  revalidatePath('/admin')
  return { success: true, message: 'Gran Campeón asignado correctamente.' }
}
