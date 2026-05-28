'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export interface ActionResult {
  error?: string
  success?: boolean
  message?: string
  data?: Record<string, unknown>
}

// ── Generar código de invitación ───────────────────────────
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ── Crear liga ─────────────────────────────────────────────

export async function createLeague(formData: FormData): Promise<ActionResult> {
  // Auth: siempre con el cliente normal (cookie-based)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const name = (formData.get('name') as string)?.trim()
  const rulesText = (formData.get('rules_text') as string)?.trim() || null
  const prizesText = (formData.get('prizes_text') as string)?.trim() || null

  if (!name || name.length < 3) {
    return { error: 'El nombre debe tener al menos 3 caracteres.' }
  }
  if (name.length > 50) {
    return { error: 'El nombre no puede superar los 50 caracteres.' }
  }

  // Todas las operaciones de DB con service client para evitar
  // problemas de RLS en leagues y league_members
  const supa = createServiceClient()

  // Límite: máx 5 ligas por usuario
  const { count: myLeagueCount } = await supa
    .from('leagues')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id)

  if ((myLeagueCount ?? 0) >= 5) {
    return { error: 'Ya creaste el máximo de 5 ligas.' }
  }

  // Generar código único
  let inviteCode = generateInviteCode()
  let attempts = 0
  while (attempts < 10) {
    const { data: existing } = await supa
      .from('leagues')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle()
    if (!existing) break
    inviteCode = generateInviteCode()
    attempts++
  }

  // Insertar la liga
  const { data: newLeague, error: leagueError } = await supa
    .from('leagues')
    .insert({
      name,
      invite_code: inviteCode,
      created_by: user.id,
      rules_text: rulesText,
      prizes_text: prizesText,
    })
    .select('id')
    .single()

  if (leagueError || !newLeague) {
    console.error('createLeague — insert error:', leagueError)
    return { error: 'Error al crear la liga.' }
  }

  // Agregar al creador como admin
  const { error: memberError } = await supa
    .from('league_members')
    .insert({
      league_id: newLeague.id,
      user_id: user.id,
      role: 'admin',
    })

  if (memberError) {
    console.error('createLeague — member insert error:', memberError)
    // Rollback: eliminar la liga si no pudimos agregar al miembro
    await supa.from('leagues').delete().eq('id', newLeague.id)
    return { error: 'Error al registrar al creador como miembro.' }
  }

  revalidatePath('/liga')
  return {
    success: true,
    message: `Liga creada. Código de invitación: ${inviteCode}`,
    data: { leagueId: newLeague.id, inviteCode },
  }
}

// ── Unirse a liga ──────────────────────────────────────────

export async function joinLeague(formData: FormData): Promise<ActionResult> {
  // Auth: siempre con el cliente normal
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const rawCode = (formData.get('invite_code') as string)?.trim().toUpperCase()
  if (!rawCode || rawCode.length !== 6) {
    return { error: 'El código debe tener 6 caracteres.' }
  }

  // Todas las operaciones de DB con service client
  const supa = createServiceClient()

  // Buscar liga por código (service client para saltar RLS de leagues)
  const { data: league, error: leagueError } = await supa
    .from('leagues')
    .select('id, name')
    .eq('invite_code', rawCode)
    .maybeSingle()

  if (leagueError) {
    console.error('joinLeague — league lookup error:', leagueError)
    return { error: 'Error al buscar la liga.' }
  }
  if (!league) {
    return { error: 'Código inválido. Verificá y volvé a intentar.' }
  }

  // ¿Ya es miembro? (service client para saltar RLS circular de league_members)
  const { data: existing, error: existingError } = await supa
    .from('league_members')
    .select('id')
    .eq('league_id', league.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) {
    console.error('joinLeague — existing member check error:', existingError)
    return { error: 'Error al verificar membresía.' }
  }
  if (existing) {
    return { error: `Ya sos miembro de "${league.name}".` }
  }

  // Límite: máx 50 miembros por liga
  const { count: memberCount, error: countError } = await supa
    .from('league_members')
    .select('id', { count: 'exact', head: true })
    .eq('league_id', league.id)

  if (countError) {
    console.error('joinLeague — member count error:', countError)
    return { error: 'Error al verificar capacidad de la liga.' }
  }
  if ((memberCount ?? 0) >= 50) {
    return { error: 'La liga ya alcanzó el máximo de 50 miembros.' }
  }

  // Insertar nuevo miembro
  const { error: joinError } = await supa
    .from('league_members')
    .insert({
      league_id: league.id,
      user_id: user.id,
      role: 'member',
    })

  if (joinError) {
    console.error('joinLeague — insert error:', joinError)
    return { error: 'Error al unirse a la liga.' }
  }

  revalidatePath('/liga')
  revalidatePath('/ranking')
  return { success: true, message: `Te uniste a "${league.name}" 🎉` }
}

// ── Salir de liga ──────────────────────────────────────────

export async function leaveLeague(leagueId: number): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const supa = createServiceClient()

  // Verificar membresía
  const { data: membership, error: membershipError } = await supa
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('leaveLeague — membership check error:', membershipError)
    return { error: 'Error al verificar membresía.' }
  }
  if (!membership) return { error: 'No sos miembro de esta liga.' }

  // Si es admin, verificar que no sea el único
  if (membership.role === 'admin') {
    const { count: adminCount } = await supa
      .from('league_members')
      .select('id', { count: 'exact', head: true })
      .eq('league_id', leagueId)
      .eq('role', 'admin')

    if ((adminCount ?? 0) <= 1) {
      return {
        error: 'Sos el único admin. Primero promové otro miembro o eliminá la liga.',
      }
    }
  }

  const { error: deleteError } = await supa
    .from('league_members')
    .delete()
    .eq('league_id', leagueId)
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('leaveLeague — delete error:', deleteError)
    return { error: 'Error al salir de la liga.' }
  }

  revalidatePath('/liga')
  revalidatePath('/ranking')
  return { success: true, message: 'Saliste de la liga.' }
}

// ── Editar liga (solo admin) ───────────────────────────────

export async function updateLeague(
  leagueId: number,
  data: { name: string; rules_text: string | null; prizes_text: string | null }
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const name = data.name?.trim()
  if (!name || name.length < 3) return { error: 'El nombre debe tener al menos 3 caracteres.' }
  if (name.length > 50) return { error: 'El nombre no puede superar los 50 caracteres.' }

  const supa = createServiceClient()

  // Verificar que el usuario sea admin de la liga
  const { data: membership, error: membershipError } = await supa
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('updateLeague — membership check error:', membershipError)
    return { error: 'Error al verificar permisos.' }
  }
  if (!membership || membership.role !== 'admin') {
    return { error: 'Solo el admin puede editar la liga.' }
  }

  const { error: updateError } = await supa
    .from('leagues')
    .update({
      name,
      rules_text: data.rules_text?.trim() || null,
      prizes_text: data.prizes_text?.trim() || null,
    })
    .eq('id', leagueId)

  if (updateError) {
    console.error('updateLeague — update error:', updateError)
    return { error: 'Error al actualizar la liga.' }
  }

  revalidatePath('/liga')
  revalidatePath('/ranking')
  return { success: true, message: 'Liga actualizada.' }
}

// ── Eliminar liga (solo creador) ───────────────────────────

export async function deleteLeague(leagueId: number): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const supa = createServiceClient()

  // Verificar que el usuario sea el creador
  const { data: league, error: leagueError } = await supa
    .from('leagues')
    .select('id, created_by')
    .eq('id', leagueId)
    .maybeSingle()

  if (leagueError) {
    console.error('deleteLeague — league fetch error:', leagueError)
    return { error: 'Error al obtener la liga.' }
  }
  if (!league) return { error: 'Liga no encontrada.' }
  if (league.created_by !== user.id) {
    return { error: 'Solo el creador puede eliminar la liga.' }
  }

  // Cascade elimina league_members por FK
  const { error: deleteError } = await supa
    .from('leagues')
    .delete()
    .eq('id', leagueId)

  if (deleteError) {
    console.error('deleteLeague — delete error:', deleteError)
    return { error: 'Error al eliminar la liga.' }
  }

  revalidatePath('/liga')
  revalidatePath('/ranking')
  return { success: true, message: 'Liga eliminada.' }
}
