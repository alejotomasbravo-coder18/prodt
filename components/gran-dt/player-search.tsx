'use client'

import { useState, useMemo } from 'react'
import type { Player, Country } from '@/lib/types'
import type { Position } from '@/lib/formations'
import { POSITION_LABELS, POSITION_SHORT } from '@/lib/formations'

interface PlayerSearchProps {
  players: (Player & { country?: Country })[]
  requiredPosition: Position
  currentTeamPlayerIds: Set<number>
  maxPerCountry: number | null
  countryCountsInTeam: Map<number, number>    // countryId → qty in team (excl. current slot)
  eliminatedCountryIds: Set<number>
  playerPoints?: Map<number, number>          // playerId → puntos acumulados del torneo
  onSelect: (player: Player & { country?: Country }) => void
  onClose: () => void
}

type SortMode = 'name' | 'points'

export default function PlayerSearch({
  players,
  requiredPosition,
  currentTeamPlayerIds,
  maxPerCountry,
  countryCountsInTeam,
  eliminatedCountryIds,
  playerPoints,
  onSelect,
  onClose,
}: PlayerSearchProps) {
  const [query, setQuery] = useState('')
  const [filterCountry, setFilterCountry] = useState<number | 'all'>('all')
  // Si hay datos de puntos, ordenar por rendimiento por defecto
  const [sortMode, setSortMode] = useState<SortMode>(
    playerPoints && playerPoints.size > 0 ? 'points' : 'name'
  )

  const hasPointsData = playerPoints && playerPoints.size > 0

  // Países disponibles (solo los que tienen jugadores en la posición requerida)
  const availableCountries = useMemo(() => {
    const seen = new Map<number, Country>()
    for (const p of players) {
      if (p.position === requiredPosition && p.country) {
        seen.set(p.country.id, p.country)
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [players, requiredPosition])

  // Filtrar y ordenar jugadores
  const filtered = useMemo(() => {
    const base = players.filter((p) => {
      if (p.position !== requiredPosition) return false
      if (!p.is_active) return false
      if (filterCountry !== 'all' && p.country_id !== filterCountry) return false
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })

    if (sortMode === 'points' && playerPoints) {
      return [...base].sort((a, b) => {
        const pa = playerPoints.get(a.id) ?? 0
        const pb = playerPoints.get(b.id) ?? 0
        if (pb !== pa) return pb - pa   // mayor primero
        return a.name.localeCompare(b.name)  // desempate alfabético
      })
    }

    return [...base].sort((a, b) => a.name.localeCompare(b.name))
  }, [players, requiredPosition, filterCountry, query, sortMode, playerPoints])

  // Determinar si un jugador está disponible (no viola el límite de país)
  function isAvailable(player: Player & { country?: Country }): {
    available: boolean
    reason?: string
  } {
    if (currentTeamPlayerIds.has(player.id)) {
      return { available: false, reason: 'Ya en tu equipo' }
    }
    if (maxPerCountry !== null && player.country_id) {
      const isEliminated = eliminatedCountryIds.has(player.country_id)
      if (!isEliminated) {
        const countInTeam = countryCountsInTeam.get(player.country_id) ?? 0
        if (countInTeam >= maxPerCountry) {
          return { available: false, reason: `Límite ${maxPerCountry} por país` }
        }
      }
    }
    return { available: true }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#112213' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '2px solid #c8a84b' }}
      >
        <div>
          <h3
            className="text-dorado text-sm font-black uppercase tracking-widest"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            {POSITION_LABELS[requiredPosition]}
          </h3>
          <p className="text-gris-texto text-xs mt-0.5">
            {filtered.length} jugadores disponibles
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gris-texto hover:text-white transition-colors p-1"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Filtros */}
      <div className="px-4 py-3 space-y-2 border-b border-verde-borde">
        {/* Búsqueda por nombre */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar jugador..."
          className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-dorado transition-colors placeholder:text-gris-texto"
          autoFocus
        />

        <div className="flex gap-2">
          {/* Filtro por país */}
          <select
            value={filterCountry}
            onChange={(e) =>
              setFilterCountry(
                e.target.value === 'all' ? 'all' : parseInt(e.target.value)
              )
            }
            className="flex-1 bg-verde-oscuro border border-verde-borde text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-dorado transition-colors"
          >
            <option value="all">Todos los países</option>
            {availableCountries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Toggle de orden — solo visible si hay datos de puntos */}
          {hasPointsData && (
            <div className="flex bg-verde-oscuro border border-verde-borde rounded overflow-hidden shrink-0">
              <button
                onClick={() => setSortMode('points')}
                className={`px-2 py-1 text-xs font-black transition-colors ${
                  sortMode === 'points'
                    ? 'bg-dorado text-verde-oscuro'
                    : 'text-gris-texto hover:text-white'
                }`}
                style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                title="Ordenar por puntos"
              >
                PTS ↓
              </button>
              <button
                onClick={() => setSortMode('name')}
                className={`px-2 py-1 text-xs font-black transition-colors ${
                  sortMode === 'name'
                    ? 'bg-dorado text-verde-oscuro'
                    : 'text-gris-texto hover:text-white'
                }`}
                style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                title="Ordenar A-Z"
              >
                A-Z
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lista de jugadores */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gris-texto text-sm px-4">
            No se encontraron {POSITION_LABELS[requiredPosition].toLowerCase()}s
            {query ? ` con "${query}"` : ''}.
          </div>
        ) : (
          <ul className="divide-y divide-verde-borde">
            {filtered.map((player) => {
              const { available, reason } = isAvailable(player)
              const pts = playerPoints?.get(player.id) ?? null
              return (
                <li key={player.id}>
                  <button
                    onClick={() => available && onSelect(player)}
                    disabled={!available}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                      ${available
                        ? 'hover:bg-verde-cancha/20 cursor-pointer'
                        : 'opacity-40 cursor-not-allowed'
                      }
                    `}
                  >
                    {/* Bandera */}
                    <div className="shrink-0 w-8">
                      {player.country?.flag_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={player.country.flag_url}
                          alt={player.country.code}
                          className="w-7 h-auto rounded-sm"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-7 h-5 bg-verde-borde rounded flex items-center justify-center">
                          <span className="text-gris-texto text-xs">
                            {player.country?.code?.slice(0, 2) ?? '?'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info jugador */}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-bold truncate">
                        {player.name}
                      </div>
                      <div className="text-gris-texto text-xs">
                        {player.country?.name ?? '—'}
                        {reason && (
                          <span className="ml-2 text-red-400">· {reason}</span>
                        )}
                      </div>
                    </div>

                    {/* Puntos acumulados + badge posición */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {pts !== null && pts > 0 && (
                        <span
                          className="text-xs font-black text-dorado tabular-nums"
                          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                          title="Puntos acumulados en el torneo"
                        >
                          {pts}
                          <span className="text-gris-texto font-normal"> pts</span>
                        </span>
                      )}
                      <span
                        className="text-xs font-black px-2 py-0.5 rounded"
                        style={{
                          background: positionColor(player.position as Position),
                          color: '#0d1f0f',
                          fontFamily: 'Arial Black, Arial, sans-serif',
                        }}
                      >
                        {POSITION_SHORT[player.position as Position]}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function positionColor(pos: Position): string {
  const colors: Record<Position, string> = {
    GK:  '#facc15',
    DEF: '#4ade80',
    MID: '#60a5fa',
    FWD: '#f87171',
  }
  return colors[pos] ?? '#c8a84b'
}
