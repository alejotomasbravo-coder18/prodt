/**
 * ProDT — Utilidades de formaciones
 *
 * Slots titulares (1-11):
 *   Slot 1:     GK  (siempre)
 *   Slots 2-5:  DEF (varía según formación)
 *   Slots 6-9:  MID (varía según formación)
 *   Slots 10-11: FWD (varía según formación)
 *
 * Slots suplentes (12-15, fijos sin importar la formación):
 *   Slot 12: ARQ suplente
 *   Slot 13: DEF suplente
 *   Slot 14: MID suplente
 *   Slot 15: FWD suplente
 */

import type { Formation } from './types'

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

// ── Suplentes: slots fijos por posición ───────────────────────

export const SUBSTITUTE_SLOT: Record<Position, number> = {
  GK:  12,
  DEF: 13,
  MID: 14,
  FWD: 15,
}

export const SUBSTITUTE_SLOTS = [12, 13, 14, 15] as const

export function isSubstituteSlot(slot: number): boolean {
  return slot >= 12 && slot <= 15
}

/** Posición requerida para un slot de suplente */
export function getSubstitutePosition(slot: number): Position {
  switch (slot) {
    case 12: return 'GK'
    case 13: return 'DEF'
    case 14: return 'MID'
    case 15: return 'FWD'
    default: throw new Error(`Slot ${slot} no es un slot de suplente válido`)
  }
}

// ── Mapping slot → posición ───────────────────────────────────

export function getSlotPosition(slot: number, formation: Formation): Position {
  // Suplentes: posición fija independiente de la formación
  if (isSubstituteSlot(slot)) return getSubstitutePosition(slot)

  if (slot === 1) return 'GK'

  switch (formation) {
    case '4-4-2':
      if (slot <= 5) return 'DEF'   // 2,3,4,5
      if (slot <= 9) return 'MID'   // 6,7,8,9
      return 'FWD'                   // 10,11

    case '4-3-3':
      if (slot <= 5) return 'DEF'   // 2,3,4,5
      if (slot <= 8) return 'MID'   // 6,7,8
      return 'FWD'                   // 9,10,11

    case '3-5-2':
      if (slot <= 4) return 'DEF'   // 2,3,4
      if (slot <= 9) return 'MID'   // 5,6,7,8,9
      return 'FWD'                   // 10,11
  }
}

// ── Slots titulares por posición ──────────────────────────────

export function getSlotsForPosition(
  position: Position,
  formation: Formation
): number[] {
  return Array.from({ length: 11 }, (_, i) => i + 1).filter(
    (s) => getSlotPosition(s, formation) === position
  )
}

// ── Descripción compacta ──────────────────────────────────────

export const FORMATION_COUNTS: Record<
  Formation,
  { def: number; mid: number; fwd: number }
> = {
  '4-4-2': { def: 4, mid: 4, fwd: 2 },
  '4-3-3': { def: 4, mid: 3, fwd: 3 },
  '3-5-2': { def: 3, mid: 5, fwd: 2 },
}

// ── Posiciones en la cancha (porcentajes x/y) ─────────────────
//
// La cancha se ve en vertical: GK abajo, FWD arriba.
//   y = 0% → arriba del área rival (FWD)
//   y = 100% → arco propio (GK)

function evenX(count: number): number[] {
  if (count === 1) return [50]
  const gap = 80 / (count - 1)
  return Array.from({ length: count }, (_, i) => 10 + i * gap)
}

export interface SlotPosition {
  slot: number
  position: Position
  xPct: number  // 0-100, izquierda→derecha
  yPct: number  // 0-100, arriba→abajo (FWD arriba, GK abajo)
}

export function getPitchLayout(formation: Formation): SlotPosition[] {
  const Y: Record<Position, number> = {
    FWD: 14,
    MID: 38,
    DEF: 62,
    GK:  84,
  }

  const result: SlotPosition[] = []

  for (const pos of ['GK', 'DEF', 'MID', 'FWD'] as Position[]) {
    const slots = getSlotsForPosition(pos, formation)
    const xs = evenX(slots.length)
    slots.forEach((slot, idx) => {
      result.push({ slot, position: pos, xPct: xs[idx], yPct: Y[pos] })
    })
  }

  return result
}

// ── Validar posición de jugador para un slot ──────────────────

export function isPositionValid(
  playerPosition: Position,
  slot: number,
  formation: Formation
): boolean {
  return getSlotPosition(slot, formation) === playerPosition
}

// ── Labels de posición ────────────────────────────────────────

export const POSITION_LABELS: Record<Position, string> = {
  GK:  'Arquero',
  DEF: 'Defensor',
  MID: 'Mediocampista',
  FWD: 'Delantero',
}

export const POSITION_SHORT: Record<Position, string> = {
  GK:  'ARQ',
  DEF: 'DEF',
  MID: 'MED',
  FWD: 'DEL',
}
