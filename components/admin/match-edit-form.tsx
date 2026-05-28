'use client'

import { useTransition, useState } from 'react'
import { updateMatchStatus, setMvp } from '@/app/actions/admin'

interface Country {
  id: number
  name: string
  code: string
}

interface Player {
  id: number
  name: string
  country_id: number
}

interface MatchEditFormProps {
  match: {
    id: number
    status: string
    home_score_90: number | null
    away_score_90: number | null
    home_score_et: number | null
    away_score_et: number | null
    went_to_et: boolean
    went_to_penalties: boolean
    winner_country_id: number | null
    mvp_player_id: number | null
    home_country_id: number
    away_country_id: number
    home_country: Country
    away_country: Country
  }
  players: Player[]
}

export default function MatchEditForm({ match, players }: MatchEditFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Estado local del formulario
  const [status, setStatus] = useState(match.status)
  const [homeScore, setHomeScore] = useState(match.home_score_90?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(match.away_score_90?.toString() ?? '')
  const [homeScoreEt, setHomeScoreEt] = useState(match.home_score_et?.toString() ?? '')
  const [awayScoreEt, setAwayScoreEt] = useState(match.away_score_et?.toString() ?? '')
  const [wentToEt, setWentToEt] = useState(match.went_to_et)
  const [wentToPenalties, setWentToPenalties] = useState(match.went_to_penalties)
  const [winnerId, setWinnerId] = useState<string>(match.winner_country_id?.toString() ?? '')
  const [mvpId, setMvpId] = useState<string>(match.mvp_player_id?.toString() ?? '')
  const [mvpPending, startMvpTransition] = useTransition()

  // Jugadores de ambos equipos
  const matchPlayers = players.filter(
    (p) => p.country_id === match.home_country_id || p.country_id === match.away_country_id
  ).sort((a, b) => a.name.localeCompare(b.name))

  function handleSave() {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await updateMatchStatus(
        match.id,
        status as 'scheduled' | 'live' | 'finished',
        homeScore ? parseInt(homeScore) : undefined,
        awayScore ? parseInt(awayScore) : undefined,
        homeScoreEt ? parseInt(homeScoreEt) : undefined,
        awayScoreEt ? parseInt(awayScoreEt) : undefined,
        wentToEt,
        wentToPenalties,
        winnerId ? parseInt(winnerId) : null,
      )
      if (result.error) setError(result.error)
      else setSuccess(result.message ?? 'Guardado.')
    })
  }

  function handleSetMvp() {
    setError(null)
    startMvpTransition(async () => {
      const result = await setMvp(match.id, mvpId ? parseInt(mvpId) : null)
      if (result.error) setError(result.error)
      else setSuccess('MVP asignado.')
    })
  }

  return (
    <div>
      <button
        onClick={() => setShowForm((v) => !v)}
        className="text-xs text-dorado hover:text-white border border-dorado/30 rounded px-3 py-1 transition-colors"
      >
        {showForm ? 'Cerrar' : 'Editar'}
      </button>

      {showForm && (
        <div className="mt-3 bg-verde-oscuro border border-verde-borde rounded-lg p-4 space-y-4">
          {/* Estado */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-verde-medio border border-verde-borde text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-dorado"
              >
                <option value="scheduled">Programado</option>
                <option value="live">En juego</option>
                <option value="finished">Finalizado</option>
              </select>
            </div>

            {/* Resultado 90min */}
            <div>
              <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
                {match.home_country.code} (90')
              </label>
              <input
                type="number"
                min={0}
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                className="w-full bg-verde-medio border border-verde-borde text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-dorado"
              />
            </div>
            <div>
              <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
                {match.away_country.code} (90')
              </label>
              <input
                type="number"
                min={0}
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                className="w-full bg-verde-medio border border-verde-borde text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-dorado"
              />
            </div>
          </div>

          {/* Tiempo extra */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={wentToEt}
                onChange={(e) => setWentToEt(e.target.checked)}
                className="accent-dorado"
              />
              <span className="text-white text-sm">Fue a tiempo extra</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={wentToPenalties}
                onChange={(e) => setWentToPenalties(e.target.checked)}
                className="accent-dorado"
              />
              <span className="text-white text-sm">Fue a penales</span>
            </label>
          </div>

          {wentToEt && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
                  {match.home_country.code} (T. extra)
                </label>
                <input
                  type="number"
                  min={0}
                  value={homeScoreEt}
                  onChange={(e) => setHomeScoreEt(e.target.value)}
                  className="w-full bg-verde-medio border border-verde-borde text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-dorado"
                />
              </div>
              <div>
                <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
                  {match.away_country.code} (T. extra)
                </label>
                <input
                  type="number"
                  min={0}
                  value={awayScoreEt}
                  onChange={(e) => setAwayScoreEt(e.target.value)}
                  className="w-full bg-verde-medio border border-verde-borde text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-dorado"
                />
              </div>
            </div>
          )}

          {/* Ganador */}
          <div>
            <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
              Ganador (eliminatorias)
            </label>
            <select
              value={winnerId}
              onChange={(e) => setWinnerId(e.target.value)}
              className="w-full bg-verde-medio border border-verde-borde text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-dorado"
            >
              <option value="">Sin ganador (empate / grupos)</option>
              <option value={match.home_country_id}>{match.home_country.name}</option>
              <option value={match.away_country_id}>{match.away_country.name}</option>
            </select>
          </div>

          {/* Feedback + guardar */}
          {error && (
            <p className="text-red-400 text-xs bg-red-950/30 border border-red-800 rounded px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-green-400 text-xs bg-verde-medio border border-green-800/30 rounded px-3 py-2">
              {success}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-dorado text-verde-oscuro font-black text-xs uppercase tracking-widest px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? 'Guardando...' : 'Guardar resultado'}
          </button>

          {/* MVP */}
          <div className="border-t border-verde-borde pt-4">
            <label className="block text-gris-texto text-xs uppercase tracking-widest mb-2">
              MVP del partido
            </label>
            <div className="flex gap-2">
              <select
                value={mvpId}
                onChange={(e) => setMvpId(e.target.value)}
                className="flex-1 bg-verde-medio border border-verde-borde text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-dorado"
              >
                <option value="">Sin MVP</option>
                {matchPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSetMvp}
                disabled={mvpPending}
                className="bg-azul-lazar text-dorado font-black text-xs uppercase tracking-widest px-4 py-1.5 rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {mvpPending ? '...' : 'Asignar MVP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
