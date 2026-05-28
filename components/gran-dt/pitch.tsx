'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import PlayerSlot from './player-slot'
import PlayerSearch from './player-search'
import { getPitchLayout, getSlotPosition, getSubstitutePosition, FORMATION_COUNTS, SUBSTITUTE_SLOT, SUBSTITUTE_SLOTS, isSubstituteSlot } from '@/lib/formations'
import type { Position } from '@/lib/formations'
import { saveTeam } from '@/app/actions/gran-dt'
import type { Player, Country, Formation } from '@/lib/types'

// ── Props ─────────────────────────────────────────────────────

interface PitchProps {
  initialFormation: Formation
  initialSlots: Map<number, Player & { country?: Country }>   // slot → player
  initialCaptainId: number | null
  allPlayers: (Player & { country?: Country })[]
  balance: number
  maxPerCountry: number | null
  eliminatedCountryIds: number[]
  deadlinePassed: boolean
  hasExistingTeam: boolean
  playerPoints?: Map<number, number>   // playerId → puntos acumulados del torneo
}

// ── Formaciones disponibles ───────────────────────────────────

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2']

// ── Cancha SVG — líneas del campo ────────────────────────────

function PitchLines() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 160"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" fill="none">
        {/* Borde exterior */}
        <rect x="3" y="3" width="94" height="154" />
        {/* Línea central */}
        <line x1="3" y1="80" x2="97" y2="80" />
        {/* Círculo central */}
        <circle cx="50" cy="80" r="15" />
        {/* Punto central */}
        <circle cx="50" cy="80" r="0.8" fill="rgba(255,255,255,0.1)" stroke="none" />
        {/* Área penal superior */}
        <rect x="22" y="3" width="56" height="22" />
        {/* Área chica superior */}
        <rect x="34" y="3" width="32" height="9" />
        {/* Punto penal superior */}
        <circle cx="50" cy="16" r="0.8" fill="rgba(255,255,255,0.1)" stroke="none" />
        {/* Área penal inferior */}
        <rect x="22" y="135" width="56" height="22" />
        {/* Área chica inferior */}
        <rect x="34" y="148" width="32" height="9" />
        {/* Punto penal inferior */}
        <circle cx="50" cy="141" r="0.8" fill="rgba(255,255,255,0.1)" stroke="none" />
      </g>
    </svg>
  )
}

// ── Componente principal ──────────────────────────────────────

export default function GranDTPitch({
  initialFormation,
  initialSlots,
  initialCaptainId,
  allPlayers,
  balance,
  maxPerCountry,
  eliminatedCountryIds,
  deadlinePassed,
  hasExistingTeam,
  playerPoints,
}: PitchProps) {
  // ── Estado ────────────────────────────────────────────────
  const [formation, setFormation] = useState<Formation>(initialFormation)
  const [slots, setSlots] = useState<Map<number, Player & { country?: Country }>>(
    new Map(initialSlots)
  )
  const [captainId, setCaptainId] = useState<number | null>(initialCaptainId)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const [saveResult, setSaveResult] = useState<{ error?: string; message?: string } | null>(null)

  const eliminatedSet = useMemo(() => new Set(eliminatedCountryIds), [eliminatedCountryIds])
  const layout = useMemo(() => getPitchLayout(formation), [formation])

  // Jugadores actualmente en el equipo (para bloquear duplicados)
  const teamPlayerIds = useMemo(() => {
    const s = new Set<number>()
    slots.forEach((p) => s.add(p.id))
    return s
  }, [slots])

  // Cuenta de jugadores por país en el equipo (excluyendo el slot seleccionado)
  const countryCountsExcludingSlot = useMemo(() => {
    const counts = new Map<number, number>()
    slots.forEach((player, slotNum) => {
      if (slotNum === selectedSlot) return
      if (!player.country_id) return
      if (eliminatedSet.has(player.country_id)) return
      counts.set(player.country_id, (counts.get(player.country_id) ?? 0) + 1)
    })
    return counts
  }, [slots, selectedSlot, eliminatedSet])

  // Calcular cuántos cambios pagados necesitará al guardar
  const pendingPaidTransfers = useMemo(() => {
    if (!hasExistingTeam) return 0
    let count = 0
    for (const [slot, player] of slots) {
      const initial = initialSlots.get(slot)
      if (!initial) continue // slot vacío antes → gratis
      if (initial.id !== player.id) {
        // Cambió; solo paga si el jugador saliente era válido
        if (initial.is_active) count++
      }
    }
    // Slots que antes tenían jugador y ahora están vacíos
    initialSlots.forEach((player, slot) => {
      if (!slots.has(slot) && player.is_active) count++
    })
    return count
  }, [slots, initialSlots, hasExistingTeam])

  // ── Handlers ──────────────────────────────────────────────

  function handleSlotClick(slot: number) {
    if (deadlinePassed) return
    setSelectedSlot(selectedSlot === slot ? null : slot)
    setSaveResult(null)
  }

  function handlePlayerSelect(player: Player & { country?: Country }) {
    if (selectedSlot === null) return
    setSlots((prev) => {
      const next = new Map(prev)
      next.set(selectedSlot, player)
      return next
    })
    setSelectedSlot(null)
  }

  function handleRemovePlayer(slot: number) {
    if (deadlinePassed) return
    setSlots((prev) => {
      const next = new Map(prev)
      next.delete(slot)
      return next
    })
    if (captainId === slots.get(slot)?.id) {
      setCaptainId(null)
    }
  }

  function handleToggleCaptain(playerId: number) {
    if (deadlinePassed) return
    setCaptainId(captainId === playerId ? null : playerId)
  }

  function handleFormationChange(f: Formation) {
    if (deadlinePassed) return
    setFormation(f)
    // Vaciar slots que quedan con posición incorrecta
    setSlots((prev) => {
      const next = new Map(prev)
      next.forEach((player, slot) => {
        const newPos = getSlotPosition(slot, f)
        if (player.position !== newPos) {
          next.delete(slot)
          if (player.id === captainId) setCaptainId(null)
        }
      })
      return next
    })
    setSaveResult(null)
  }

  function handleSave() {
    setSaveResult(null)
    startTransition(async () => {
      // Titulares (slots 1-11) + suplentes opcionales (slots 12-15)
      const starterData = Array.from({ length: 11 }, (_, i) => ({
        slot: i + 1,
        playerId: slots.get(i + 1)?.id ?? null,
      }))
      const subData = SUBSTITUTE_SLOTS.map((slot) => ({
        slot,
        playerId: slots.get(slot)?.id ?? null,
      }))
      const result = await saveTeam(formation, [...starterData, ...subData], captainId)
      setSaveResult(result)
    })
  }

  // ── Contadores ────────────────────────────────────────────
  // Solo cuentan los titulares para "listo para guardar"
  const filledCount = Array.from(slots.keys()).filter((s) => !isSubstituteSlot(s)).length
  const isReadyToSave = filledCount === 11 && captainId !== null

  // ── Posición requerida para el slot seleccionado ──────────
  const selectedPosition = selectedSlot
    ? getSlotPosition(selectedSlot, formation)
    : null

  const counts = FORMATION_COUNTS[formation]

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">

      {/* ── Panel izquierdo: controles + cancha ────────────── */}
      <div className="flex flex-col gap-4 flex-1 min-w-0">

        {/* Selector de formación */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="text-gris-texto text-xs font-black uppercase tracking-widest"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Formación
          </span>
          <div className="flex gap-1 bg-verde-medio border border-verde-borde rounded-lg p-1">
            {FORMATIONS.map((f) => (
              <button
                key={f}
                onClick={() => handleFormationChange(f)}
                disabled={deadlinePassed}
                className={`
                  px-3 py-1.5 rounded text-xs font-black uppercase tracking-widest transition-all
                  ${formation === f
                    ? 'bg-dorado text-verde-oscuro'
                    : 'text-gris-texto hover:text-white disabled:hover:text-gris-texto'
                  }
                  disabled:cursor-not-allowed
                `}
                style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Descripción de formación */}
          <span className="text-gris-texto text-xs">
            {counts.def} DEF · {counts.mid} MED · {counts.fwd} DEL
          </span>
        </div>

        {/* Cancha + banners Lazar */}
        <div className="flex gap-0 items-stretch">

          {/* Banner lateral izquierdo */}
          <div
            className="w-5 rounded-l flex items-center justify-center shrink-0"
            style={{ background: '#0f2557' }}
          >
            <span
              className="text-dorado text-xs font-black uppercase tracking-widest"
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                letterSpacing: '0.15em',
                fontSize: '9px',
                fontFamily: 'Arial Black, Arial, sans-serif',
              }}
            >
              LAZAR · SÍMBOLO DE CONFIANZA
            </span>
          </div>

          {/* La cancha */}
          <div
            className="relative flex-1"
            style={{
              background: 'repeating-linear-gradient(180deg, #0f2213 0px, #0f2213 48px, #0d1f0f 48px, #0d1f0f 96px)',
              aspectRatio: '2 / 3',
              minHeight: '400px',
            }}
          >
            <PitchLines />

            {/* Jugadores en la cancha */}
            {layout.map(({ slot, position, xPct, yPct }) => {
              const player = slots.get(slot) ?? null
              return (
                <div
                  key={slot}
                  className="absolute"
                  style={{
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <PlayerSlot
                    slot={slot}
                    requiredPosition={position}
                    player={player}
                    isCaptain={player?.id === captainId}
                    isSelected={selectedSlot === slot}
                    deadlinePassed={deadlinePassed}
                    onClick={() => handleSlotClick(slot)}
                  />

                  {/* Menú contextual al seleccionar */}
                  {selectedSlot === slot && !deadlinePassed && (
                    <div
                      className="absolute z-20 left-1/2 -translate-x-1/2 flex flex-col gap-1"
                      style={{ top: 'calc(100% + 4px)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Quitar jugador (si hay) */}
                      {player && (
                        <>
                          <button
                            onClick={() => handleRemovePlayer(slot)}
                            className="bg-red-900 text-red-200 text-xs px-2 py-1 rounded border border-red-700 hover:bg-red-800 transition-colors whitespace-nowrap"
                          >
                            ✕ Quitar
                          </button>
                          <button
                            onClick={() => handleToggleCaptain(player.id)}
                            className={`text-xs px-2 py-1 rounded border whitespace-nowrap transition-colors ${
                              captainId === player.id
                                ? 'bg-blue-900 text-blue-200 border-blue-700 hover:bg-blue-800'
                                : 'bg-verde-medio text-dorado border-dorado/50 hover:bg-dorado/10'
                            }`}
                          >
                            {captainId === player.id ? '✓ Capitán' : '⭐ Capitán'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Overlay de deadline */}
            {deadlinePassed && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded pointer-events-none">
                <span
                  className="bg-verde-oscuro/90 text-dorado text-xs font-black uppercase tracking-widest px-4 py-2 rounded border border-dorado/50"
                  style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                >
                  Deadline cerrado
                </span>
              </div>
            )}
          </div>

          {/* Banner lateral derecho */}
          <div
            className="w-5 rounded-r flex items-center justify-center shrink-0"
            style={{ background: '#0f2557' }}
          >
            <span
              className="text-dorado text-xs font-black uppercase tracking-widest"
              style={{
                writingMode: 'vertical-rl',
                letterSpacing: '0.15em',
                fontSize: '9px',
                fontFamily: 'Arial Black, Arial, sans-serif',
              }}
            >
              LAZAR · SÍMBOLO DE CONFIANZA
            </span>
          </div>
        </div>

        {/* Banco de suplentes */}
        <div
          className="rounded-lg border border-verde-borde p-3"
          style={{ background: '#0d1a0f' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-gris-texto text-xs font-black uppercase tracking-widest"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              Banco de suplentes
            </span>
            <span className="text-gris-texto text-xs opacity-60">
              — entra automáticamente si un titular no juega
            </span>
          </div>

          <div className="flex gap-4 justify-center flex-wrap">
            {SUBSTITUTE_SLOTS.map((slot) => {
              const position = getSubstitutePosition(slot)
              const player = slots.get(slot) ?? null
              const posLabels: Record<string, string> = { GK: 'ARQ', DEF: 'DEF', MID: 'MED', FWD: 'DEL' }
              return (
                <div key={slot} className="flex flex-col items-center gap-1 relative">
                  {/* Etiqueta de posición */}
                  <span
                    className="text-gris-texto text-xs font-black uppercase tracking-widest"
                    style={{ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '9px' }}
                  >
                    {posLabels[position]}
                  </span>

                  <PlayerSlot
                    slot={slot}
                    requiredPosition={position}
                    player={player}
                    isCaptain={false}
                    isSelected={selectedSlot === slot}
                    deadlinePassed={deadlinePassed}
                    onClick={() => handleSlotClick(slot)}
                  />

                  {/* Menú contextual del suplente */}
                  {selectedSlot === slot && !deadlinePassed && (
                    <div
                      className="absolute z-20 left-1/2 -translate-x-1/2 flex flex-col gap-1"
                      style={{ top: 'calc(100% + 4px)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {player && (
                        <button
                          onClick={() => handleRemovePlayer(slot)}
                          className="bg-red-900 text-red-200 text-xs px-2 py-1 rounded border border-red-700 hover:bg-red-800 transition-colors whitespace-nowrap"
                        >
                          ✕ Quitar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer de la cancha: stats + guardar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-4 text-xs">
            <span className="text-gris-texto">
              <span
                className={`font-black text-base ${filledCount === 11 ? 'text-green-400' : 'text-dorado'}`}
                style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
              >
                {filledCount}
              </span>
              /11 jugadores
            </span>
            {captainId ? (
              <span className="text-gris-texto">
                <span className="font-bold text-blue-400">C</span> asignado
              </span>
            ) : (
              <span className="text-red-400">Sin capitán</span>
            )}
            {!deadlinePassed && balance >= 0 && hasExistingTeam && (
              <span className="text-gris-texto">
                <span className={`font-black ${balance < pendingPaidTransfers ? 'text-red-400' : 'text-dorado'}`}>
                  {balance}
                </span>
                {' '}cambio{balance !== 1 ? 's' : ''} disponible{balance !== 1 ? 's' : ''}
                {pendingPaidTransfers > 0 && (
                  <span className={balance < pendingPaidTransfers ? 'text-red-400' : 'text-gris-texto'}>
                    {' '}(usará {pendingPaidTransfers})
                  </span>
                )}
              </span>
            )}
          </div>

          {!deadlinePassed && (
            <button
              onClick={handleSave}
              disabled={isPending || !isReadyToSave}
              className="bg-dorado text-verde-oscuro text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              {isPending
                ? 'Guardando...'
                : !isReadyToSave
                ? `Completá el equipo (${11 - filledCount} slots)`
                : hasExistingTeam
                ? pendingPaidTransfers > 0
                  ? `Guardar (${pendingPaidTransfers} cambio${pendingPaidTransfers > 1 ? 's' : ''})`
                  : 'Guardar equipo'
                : 'Armar equipo'}
            </button>
          )}
        </div>

        {/* Feedback de guardado */}
        {saveResult && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-bold ${
              saveResult.error
                ? 'bg-red-900/40 border border-red-700 text-red-300'
                : 'bg-green-900/40 border border-green-700 text-green-300'
            }`}
          >
            {saveResult.error ?? saveResult.message}
          </div>
        )}
      </div>

      {/* ── Panel derecho: búsqueda de jugadores ────────────── */}
      <div
        className={`
          lg:w-72 xl:w-80 shrink-0
          ${selectedSlot !== null
            ? 'block'
            : 'hidden lg:block lg:invisible lg:pointer-events-none'
          }
        `}
        style={{
          height: 'calc(100vh - 7rem)',
          position: 'sticky',
          top: '4rem',
        }}
      >
        {selectedSlot !== null && selectedPosition ? (
          <div
            className="h-full rounded-lg overflow-hidden border border-verde-borde"
          >
            <PlayerSearch
              players={allPlayers}
              requiredPosition={selectedPosition}
              currentTeamPlayerIds={teamPlayerIds}
              maxPerCountry={maxPerCountry}
              countryCountsInTeam={countryCountsExcludingSlot}
              eliminatedCountryIds={eliminatedSet}
              playerPoints={playerPoints}
              onSelect={handlePlayerSelect}
              onClose={() => setSelectedSlot(null)}
            />
          </div>
        ) : (
          <div className="h-full rounded-lg border border-verde-borde flex items-center justify-center">
            <div className="text-center p-6">
              <p className="text-4xl mb-3">⚽</p>
              <p className="text-gris-texto text-sm">
                Tocá un slot en la cancha para agregar un jugador
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Drawer móvil para la búsqueda */}
      {selectedSlot !== null && selectedPosition && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 shadow-2xl" style={{ height: '65vh' }}>
          <div
            className="h-full rounded-t-xl overflow-hidden border-t border-x border-dorado/50"
            style={{ background: '#112213' }}
          >
            <PlayerSearch
              players={allPlayers}
              requiredPosition={selectedPosition}
              currentTeamPlayerIds={teamPlayerIds}
              maxPerCountry={maxPerCountry}
              countryCountsInTeam={countryCountsExcludingSlot}
              eliminatedCountryIds={eliminatedSet}
              playerPoints={playerPoints}
              onSelect={handlePlayerSelect}
              onClose={() => setSelectedSlot(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
