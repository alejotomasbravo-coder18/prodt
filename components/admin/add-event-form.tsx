'use client'

import { useTransition, useState } from 'react'
import { addMatchEvent, deleteMatchEvent } from '@/app/actions/admin'

interface Player {
  id: number
  name: string
  country_id: number
}

interface Event {
  id: number
  player_id: number
  event_type: string
  minute: number | null
  is_extra_time: boolean
  player: { name: string } | null
}

interface AddEventFormProps {
  matchId: number
  homePlayers: Player[]
  awayPlayers: Player[]
  existingEvents: Event[]
  homeCountryName: string
  awayCountryName: string
}

const EVENT_TYPES = [
  { value: 'goal',          label: 'Gol' },
  { value: 'assist',        label: 'Asistencia' },
  { value: 'yellow_card',   label: 'Tarjeta amarilla' },
  { value: 'red_card',      label: 'Tarjeta roja' },
  { value: 'own_goal',      label: 'Autogol' },
  { value: 'penalty_saved', label: 'Penal atajado' },
  { value: 'clean_sheet',   label: 'Valla invicta' },
  { value: 'did_not_play',  label: 'No jugó (activa suplente)' },
]

const EVENT_COLORS: Record<string, string> = {
  goal:          'text-green-400',
  assist:        'text-blue-400',
  yellow_card:   'text-yellow-400',
  red_card:      'text-red-400',
  own_goal:      'text-orange-400',
  penalty_saved: 'text-purple-400',
  clean_sheet:   'text-teal-400',
  mvp:           'text-dorado',
  did_not_play:  'text-gray-400',
}

export default function AddEventForm({
  matchId,
  homePlayers,
  awayPlayers,
  existingEvents,
  homeCountryName,
  awayCountryName,
}: AddEventFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const formData = new FormData(e.currentTarget)
    formData.set('match_id', matchId.toString())

    startTransition(async () => {
      const result = await addMatchEvent(formData)
      if (result.error) setError(result.error)
      else {
        setSuccess('Evento agregado.')
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  function handleDelete(eventId: number) {
    startTransition(async () => {
      await deleteMatchEvent(eventId)
    })
  }

  const allPlayers = [
    ...homePlayers.map((p) => ({ ...p, team: homeCountryName })),
    ...awayPlayers.map((p) => ({ ...p, team: awayCountryName })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-4">
      {/* Eventos existentes */}
      {existingEvents.length > 0 && (
        <div className="space-y-1">
          <p className="text-gris-texto text-xs uppercase tracking-widest mb-2">
            Eventos cargados ({existingEvents.length})
          </p>
          {existingEvents.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center justify-between gap-3 px-3 py-2 bg-verde-oscuro rounded border border-verde-borde"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className={`font-bold ${EVENT_COLORS[ev.event_type] ?? 'text-white'}`}>
                  {EVENT_TYPES.find((t) => t.value === ev.event_type)?.label ?? ev.event_type}
                </span>
                <span className="text-white">{ev.player?.name ?? '—'}</span>
                {ev.minute && (
                  <span className="text-gris-texto text-xs">
                    {ev.minute}&apos;{ev.is_extra_time ? '+' : ''}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleDelete(ev.id)}
                disabled={isPending}
                className="text-red-400 hover:text-red-300 text-xs transition-colors disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario nuevo evento */}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <input type="hidden" name="match_id" value={matchId} />

        <div className="col-span-2 sm:col-span-1">
          <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
            Jugador *
          </label>
          <select
            name="player_id"
            required
            className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-dorado"
          >
            <option value="">Seleccionar...</option>
            <optgroup label={homeCountryName}>
              {homePlayers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
            <optgroup label={awayCountryName}>
              {awayPlayers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div>
          <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
            Tipo *
          </label>
          <select
            name="event_type"
            required
            className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-dorado"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
            Minuto
          </label>
          <input
            type="number"
            name="minute"
            min={1}
            max={120}
            placeholder="45"
            className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-dorado"
          />
        </div>

        <div className="flex flex-col justify-between">
          <label className="flex items-center gap-2 mt-5 cursor-pointer">
            <input
              type="checkbox"
              name="is_extra_time"
              value="true"
              className="accent-dorado"
            />
            <span className="text-white text-xs">T. extra</span>
          </label>
        </div>

        <div className="col-span-2 sm:col-span-4">
          {error && (
            <p className="text-red-400 text-xs mb-2 bg-red-950/30 border border-red-800 rounded px-3 py-1.5">
              {error}
            </p>
          )}
          {success && (
            <p className="text-green-400 text-xs mb-2">{success}</p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="bg-dorado text-verde-oscuro font-black text-xs uppercase tracking-widest px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? 'Agregando...' : '+ Agregar evento'}
          </button>
        </div>
      </form>
    </div>
  )
}
