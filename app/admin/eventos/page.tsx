import { createClient } from '@/lib/supabase/server'
import AddEventForm from '@/components/admin/add-event-form'

interface PageProps {
  searchParams: Promise<{ match?: string }>
}

export default async function AdminEventosPage({ searchParams }: PageProps) {
  const { match: matchParam } = await searchParams
  const selectedMatchId = matchParam ? parseInt(matchParam) : null

  const supabase = await createClient()

  // Partidos finalizados o en vivo (los únicos que pueden tener eventos)
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, kickoff_at, status,
      home_country:countries!home_country_id (id, name, code),
      away_country:countries!away_country_id (id, name, code)
    `)
    .in('status', ['live', 'finished'])
    .order('kickoff_at', { ascending: false })

  // Partido seleccionado
  let selectedMatch: (typeof matches extends (infer T)[] | null ? T : never) | null = null
  let matchEvents: {
    id: number
    player_id: number
    event_type: string
    minute: number | null
    is_extra_time: boolean
    player: { name: string } | null
  }[] = []
  let homePlayers: { id: number; name: string; country_id: number }[] = []
  let awayPlayers: { id: number; name: string; country_id: number }[] = []

  if (selectedMatchId && matches) {
    selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? null

    if (selectedMatch) {
      const home = selectedMatch.home_country as { id: number; name: string; code: string }
      const away = selectedMatch.away_country as { id: number; name: string; code: string }

      // Eventos del partido
      const { data: eventsRaw } = await supabase
        .from('match_events')
        .select(`
          id, player_id, event_type, minute, is_extra_time,
          player:players (name)
        `)
        .eq('match_id', selectedMatchId)
        .order('minute', { ascending: true, nullsFirst: false })

      matchEvents = (eventsRaw ?? []).map((e) => ({
        id: e.id,
        player_id: e.player_id,
        event_type: e.event_type,
        minute: e.minute,
        is_extra_time: e.is_extra_time,
        player: e.player as { name: string } | null,
      }))

      // Jugadores de ambos equipos
      const { data: playersData } = await supabase
        .from('players')
        .select('id, name, country_id')
        .in('country_id', [home.id, away.id])
        .eq('is_active', true)
        .order('name', { ascending: true })

      homePlayers = (playersData ?? []).filter((p) => p.country_id === home.id)
      awayPlayers = (playersData ?? []).filter((p) => p.country_id === away.id)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-black text-white uppercase tracking-widest"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          Eventos de partido
        </h1>
        <p className="text-gris-texto text-sm mt-1">
          Cargá goles, asistencias y tarjetas por partido.
        </p>
      </div>

      {/* Selector de partido */}
      <div className="bg-verde-medio border border-verde-borde rounded-lg p-4">
        <label className="block text-gris-texto text-xs uppercase tracking-widest mb-2">
          Seleccioná un partido
        </label>
        <div className="flex gap-2 flex-wrap">
          {(matches ?? []).length === 0 ? (
            <p className="text-gris-texto text-sm">No hay partidos finalizados ni en juego.</p>
          ) : (
            (matches ?? []).map((m) => {
              const home = m.home_country as { id: number; name: string; code: string }
              const away = m.away_country as { id: number; name: string; code: string }
              const isSelected = m.id === selectedMatchId

              return (
                <a
                  key={m.id}
                  href={`/admin/eventos?match=${m.id}`}
                  className={`
                    text-xs font-bold px-3 py-2 rounded border transition-colors
                    ${isSelected
                      ? 'bg-dorado text-verde-oscuro border-dorado'
                      : 'bg-verde-oscuro border-verde-borde text-white hover:border-dorado/50'
                    }
                  `}
                >
                  {home?.code} vs {away?.code}
                  <span className={`ml-1.5 ${isSelected ? 'text-verde-oscuro/60' : 'text-gris-texto'}`}>
                    {m.status === 'live' ? '🔴' : '✓'}
                  </span>
                </a>
              )
            })
          )}
        </div>
      </div>

      {/* Formulario de eventos */}
      {selectedMatch ? (
        <div className="bg-verde-medio border border-verde-borde rounded-lg p-5 space-y-4">
          <div>
            <h2
              className="text-white font-black uppercase tracking-widest text-base"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              {(selectedMatch.home_country as { name: string })?.name} vs{' '}
              {(selectedMatch.away_country as { name: string })?.name}
            </h2>
            <p className="text-gris-texto text-xs mt-0.5">
              {new Date(selectedMatch.kickoff_at).toLocaleString('es-AR')}
            </p>
          </div>

          <AddEventForm
            matchId={selectedMatch.id}
            homePlayers={homePlayers}
            awayPlayers={awayPlayers}
            existingEvents={matchEvents}
            homeCountryName={(selectedMatch.home_country as { name: string })?.name ?? ''}
            awayCountryName={(selectedMatch.away_country as { name: string })?.name ?? ''}
          />
        </div>
      ) : (
        matches && matches.length > 0 && (
          <div className="text-center py-10 bg-verde-medio border border-verde-borde rounded-lg">
            <p className="text-gris-texto text-sm">
              Seleccioná un partido para cargar sus eventos.
            </p>
          </div>
        )
      )}
    </div>
  )
}
