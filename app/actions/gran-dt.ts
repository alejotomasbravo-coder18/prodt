'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSlotPosition, isSubstituteSlot, SUBSTITUTE_SLOTS } from '@/lib/formations'
import type { Formation } from '@/lib/types'

export interface ActionResult {
  error?: string
  success?: boolean
  message?: string
}

// ── Tipos de slot ─────────────────────────────────────────────

export interface SlotData {
  slot: number           // 1-11
  playerId: number | null
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Verifica que el siguiente partido no haya empezado todavía.
 * Devuelve el kickoff más próximo (o null si no hay partidos cargados).
 */
async function checkDeadline(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ passed: boolean; nextKickoff: string | null }> {
  const { data: nextMatch } = await supabase
    .from('matches')
    .select('kickoff_at, status')
    .in('status', ['scheduled', 'live'])
    .not('home_country_id', 'is', null)
    .order('kickoff_at', { ascending: true })
    .limit(1)
    .single()

  if (!nextMatch) return { passed: false, nextKickoff: null }

  const kickoff = new Date(nextMatch.kickoff_at)
  const now = new Date()

  return {
    passed: kickoff <= now || nextMatch.status === 'live',
    nextKickoff: nextMatch.kickoff_at,
  }
}

/**
 * Devuelve el max_per_country de la fase activa.
 * Fase activa = la de mayor phase_order que tenga started_at != null,
 * o la fase 1 (Grupos) si ninguna inició.
 */
async function getActivePhaseLimit(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number | null> {
  const { data: phases } = await supabase
    .from('phases')
    .select('id, phase_order, max_per_country, started_at')
    .order('phase_order', { ascending: false })

  if (!phases || phases.length === 0) return 1 // default: grupos = 1

  // La fase activa es la de mayor phase_order que ya inició
  const activePhase = phases.find((p) => p.started_at !== null) ?? phases[phases.length - 1]
  return activePhase.max_per_country
}

/**
 * Cuenta cuántos jugadores de cada país tiene el equipo actual
 * (excluyendo países eliminados, ya que para ellos no hay límite).
 */
function countByCountry(
  slots: SlotData[],
  playerCountryMap: Map<number, number>,  // playerId → countryId
  eliminatedCountries: Set<number>         // countryIds eliminados
): Map<number, number> {
  const counts = new Map<number, number>()
  for (const { playerId } of slots) {
    if (!playerId) continue
    const countryId = playerCountryMap.get(playerId)
    if (!countryId) continue
    if (eliminatedCountries.has(countryId)) continue  // sin límite
    counts.set(countryId, (counts.get(countryId) ?? 0) + 1)
  }
  return counts
}

// ── Guardar equipo (inicial o edición) ───────────────────────

/**
 * Guarda el equipo completo del usuario.
 *
 * Si es la primera vez → todos los slots son gratuitos.
 * Si ya existe equipo → por cada slot con jugador distinto al anterior,
 *   se registra un transfer y se descuenta 1 del balance
 *   (excepto si el jugador saliente era inválido → gratis).
 */
export async function saveTeam(
  formation: Formation,
  slots: SlotData[],
  captainPlayerId: number | null
): Promise<ActionResult> {
  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  // ── Deadline ──────────────────────────────────────────────
  const { passed } = await checkDeadline(supabase)
  if (passed) {
    return { error: 'Deadline cerrado. El próximo partido ya comenzó.' }
  }

  // ── Validar estructura de slots ───────────────────────────
  // Slots válidos: 1-15 (1-11 titulares, 12-15 suplentes)
  const validSlotNums = new Set([...Array.from({length: 11}, (_, i) => i + 1), ...SUBSTITUTE_SLOTS])
  for (const { slot } of slots) {
    if (!validSlotNums.has(slot)) {
      return { error: `Slot ${slot} no es válido.` }
    }
  }

  // Separar titulares y suplentes
  const starterSlots = slots.filter((s) => !isSubstituteSlot(s.slot))
  const substituteSlots = slots.filter((s) => isSubstituteSlot(s.slot))

  // Los 11 titulares son obligatorios
  if (starterSlots.length !== 11) {
    return { error: 'El equipo debe tener exactamente 11 titulares (slots 1-11).' }
  }

  // Separar slots con jugador vs vacíos (titulares)
  const filledSlots = slots.filter((s) => s.playerId !== null)

  const filledStarters = starterSlots.filter((s) => s.playerId !== null)
  if (filledStarters.length === 0) {
    return { error: 'El equipo está vacío.' }
  }

  // ── Obtener datos de jugadores ────────────────────────────
  const playerIds = filledSlots.map((s) => s.playerId!)

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, position, country_id, is_active')
    .in('id', playerIds)

  if (playersError || !players) {
    return { error: 'Error al verificar los jugadores.' }
  }

  const playerMap = new Map(players.map((p) => [p.id, p]))

  // ── Obtener países eliminados ─────────────────────────────
  const { data: eliminatedCountries } = await supabase
    .from('countries')
    .select('id')
    .eq('eliminated', true)

  const eliminatedSet = new Set((eliminatedCountries ?? []).map((c) => c.id))

  // ── Límite de país según fase activa ──────────────────────
  const maxPerCountry = await getActivePhaseLimit(supabase)

  // ── Validación 1: posición estricta ───────────────────────
  for (const { slot, playerId } of filledSlots) {
    if (!playerId) continue
    const player = playerMap.get(playerId)
    if (!player) return { error: `Jugador ${playerId} no encontrado.` }

    const requiredPos = getSlotPosition(slot, formation)
    if (player.position !== requiredPos) {
      return {
        error: `El slot ${slot} requiere ${requiredPos}, pero el jugador es ${player.position}.`,
      }
    }
  }

  // ── Validación 2: jugador activo ──────────────────────────
  for (const { playerId } of filledSlots) {
    const player = playerMap.get(playerId!)
    if (player && !player.is_active) {
      return { error: `El jugador ID ${playerId} no está activo en el torneo.` }
    }
  }

  // ── Validación 3: límite por país ─────────────────────────
  if (maxPerCountry !== null) {
    const playerCountryMap = new Map(players.map((p) => [p.id, p.country_id]))
    const countsByCt = countByCountry(filledSlots, playerCountryMap, eliminatedSet)

    for (const [countryId, count] of countsByCt.entries()) {
      if (count > maxPerCountry) {
        const { data: ctry } = await supabase
          .from('countries')
          .select('name')
          .eq('id', countryId)
          .single()

        return {
          error: `Máximo ${maxPerCountry} jugador${maxPerCountry > 1 ? 'es' : ''} de ${ctry?.name ?? 'ese país'} en la fase actual.`,
        }
      }
    }
  }

  // ── Validación 4: capitán debe ser titular (no suplente) ──
  if (captainPlayerId) {
    const captainInStarters = starterSlots.some((s) => s.playerId === captainPlayerId)
    if (!captainInStarters) {
      return { error: 'El capitán debe ser un titular (no puede ser suplente).' }
    }
  }

  // ── Verificar equipo existente (para calcular transfers) ──
  const { data: existingTeam } = await supabase
    .from('user_teams')
    .select('id, formation, captain_player_id')
    .eq('user_id', user.id)
    .single()

  let existingSlotMap = new Map<number, number | null>()
  let paidTransfers = 0
  let teamId: number | null = existingTeam?.id ?? null

  if (existingTeam) {
    // Obtener slots actuales
    const { data: existingSlots } = await supabase
      .from('user_team_players')
      .select('slot, player_id')
      .eq('user_team_id', existingTeam.id)

    for (const s of existingSlots ?? []) {
      existingSlotMap.set(s.slot, s.player_id)
    }

    // Calcular transfers necesarios
    const transfersToRecord: Array<{
      playerOut: number | null
      playerIn: number | null
      isFree: boolean
    }> = []

    for (const { slot, playerId: newPlayerId } of slots) {
      const oldPlayerId = existingSlotMap.get(slot) ?? null
      if (oldPlayerId === newPlayerId) continue  // sin cambio

      const oldPlayer = oldPlayerId ? playerMap.get(oldPlayerId) : null
      const playerOutInvalid = oldPlayer
        ? !oldPlayer.is_active
        : false

      const isFree = !oldPlayerId || playerOutInvalid

      transfersToRecord.push({
        playerOut: oldPlayerId,
        playerIn:  newPlayerId,
        isFree,
      })

      if (!isFree) paidTransfers++
    }

    // ── Verificar balance ─────────────────────────────────
    if (paidTransfers > 0) {
      const { data: balance } = await supabase
        .from('user_transfer_balance')
        .select('available')
        .eq('user_id', user.id)
        .single()

      const available = balance?.available ?? 0
      if (available < paidTransfers) {
        return {
          error: `Sin cambios disponibles. Necesitás ${paidTransfers} cambio${paidTransfers > 1 ? 's' : ''} y tenés ${available}.`,
        }
      }

      // Descontar del balance
      await supabase
        .from('user_transfer_balance')
        .update({
          available: available - paidTransfers,
          total_used: available, // se actualiza abajo
        })
        .eq('user_id', user.id)

      // Actualizar total_used correctamente
      const { data: updatedBalance } = await supabase
        .from('user_transfer_balance')
        .select('total_used')
        .eq('user_id', user.id)
        .single()

      await supabase
        .from('user_transfer_balance')
        .update({ total_used: (updatedBalance?.total_used ?? 0) + paidTransfers })
        .eq('user_id', user.id)
    }

    // Registrar transfers en historial
    for (const tr of transfersToRecord) {
      if (tr.playerOut === null && tr.playerIn === null) continue
      await supabase.from('transfers').insert({
        user_id:       user.id,
        player_out_id: tr.playerOut,
        player_in_id:  tr.playerIn,
        is_free:       tr.isFree,
      })
    }
  }

  // ── Upsert user_teams ─────────────────────────────────────
  if (!teamId) {
    const { data: newTeam, error: teamError } = await supabase
      .from('user_teams')
      .insert({
        user_id:           user.id,
        formation,
        captain_player_id: captainPlayerId,
        updated_at:        new Date().toISOString(),
      })
      .select('id')
      .single()

    if (teamError || !newTeam) {
      return { error: 'Error al crear el equipo.' }
    }
    teamId = newTeam.id
  } else {
    await supabase
      .from('user_teams')
      .update({
        formation,
        captain_player_id: captainPlayerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamId)
  }

  // ── Eliminar slots actuales e insertar nuevos ─────────────
  await supabase
    .from('user_team_players')
    .delete()
    .eq('user_team_id', teamId)

  const slotInserts = slots
    .filter((s) => s.playerId !== null)
    .map((s) => ({
      user_team_id: teamId!,
      player_id:    s.playerId!,
      slot:         s.slot,
    }))

  if (slotInserts.length > 0) {
    const { error: insertError } = await supabase
      .from('user_team_players')
      .insert(slotInserts)

    if (insertError) {
      return { error: 'Error al guardar los jugadores del equipo.' }
    }
  }

  revalidatePath('/gran-dt')
  revalidatePath('/dashboard')

  const msg =
    paidTransfers > 0
      ? `Equipo guardado. Se usaron ${paidTransfers} cambio${paidTransfers > 1 ? 's' : ''}.`
      : 'Equipo guardado.'

  return { success: true, message: msg }
}

// ── Cambiar solo la formación ─────────────────────────────────

/**
 * Cambia la formación del equipo.
 * Si un jugador queda en un slot incompatible, ese slot se vacía.
 * No tiene costo de cambio (solo la formación, no los jugadores).
 */
export async function changeFormation(
  formation: Formation
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { passed } = await checkDeadline(supabase)
  if (passed) return { error: 'Deadline cerrado.' }

  const { data: team } = await supabase
    .from('user_teams')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!team) return { error: 'No tenés un equipo todavía.' }

  await supabase
    .from('user_teams')
    .update({ formation, updated_at: new Date().toISOString() })
    .eq('id', team.id)

  revalidatePath('/gran-dt')
  return { success: true, message: 'Formación actualizada.' }
}

// ── Asignar/quitar capitán ────────────────────────────────────

export async function setCaptain(
  playerId: number | null
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { passed } = await checkDeadline(supabase)
  if (passed) return { error: 'Deadline cerrado.' }

  const { error } = await supabase
    .from('user_teams')
    .update({ captain_player_id: playerId, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (error) return { error: 'Error al actualizar el capitán.' }

  revalidatePath('/gran-dt')
  return { success: true }
}
