import { createClient } from '@/lib/supabase/server'
import MatchCard from '@/components/prode/match-card'
import type { Match, ProdePrediction } from '@/lib/types'
import Link from 'next/link'

// Filtros via URL params → no necesita estado cliente
type Filter = 'upcoming' | 'live' | 'finished' | 'all'

interface Props {
  searchParams: Promise<{ filter?: string }>
}

// ── Helpers ──────────────────────────────────────────────────

function groupByDate(matches: Match[]): Map<string, Match[]> {
  const map = new Map<string, Match[]>()
  for (const m of matches) {
    const key = new Date(m.kickoff_at).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }
  return map
}

function filterLabel(filter: Filter): string {
  const labels: Record<Filter, string> = {
    upcoming: 'Próximos',
    live:     'En juego',
    finished: 'Finalizados',
    all:      'Todos',
  }
  return labels[filter]
}

// ── Page ─────────────────────────────────────────────────────

export default async function ProdePage({ searchParams }: Props) {
  const params = await searchParams
  const filter = (params.filter as Filter) || 'upcoming'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Fetch partidos ────────────────────────────────────────
  let query = supabase
    .from('matches')
    .select(`
      id, kickoff_at, status, phase_id,
      home_score_90, away_score_90,
      home_score_et, away_score_et,
      went_to_et, went_to_penalties,
      winner_country_id, points_published,
      home_country_id, away_country_id,
      phase:phases (id, name, phase_order, max_per_country, started_at),
      home_country:countries!home_country_id (id, name, code, flag_url, eliminated, eliminated_at),
      away_country:countries!away_country_id (id, name, code, flag_url, eliminated, eliminated_at)
    `)
    .not('home_country_id', 'is', null)
    .not('away_country_id', 'is', null)
    .order('kickoff_at', { ascending: true })

  // Aplicar filtro
  if (filter === 'upcoming') {
    query = query.in('status', ['scheduled'])
  } else if (filter === 'live') {
    query = query.eq('status', 'live')
  } else if (filter === 'finished') {
    query = query.eq('status', 'finished')
  }
  // 'all' → sin filtro adicional

  const { data: matchesRaw } = await query

  // ── Fetch predicciones del usuario ────────────────────────
  const { data: predictionsRaw } = await supabase
    .from('prode_predictions')
    .select('*')
    .eq('user_id', user!.id)

  // Mapa matchId → predicción
  const predMap = new Map<number, ProdePrediction>()
  for (const p of predictionsRaw ?? []) {
    predMap.set(p.match_id, p as ProdePrediction)
  }

  // ── Estadísticas rápidas ──────────────────────────────────
  const allPreds = predictionsRaw ?? []
  const evaluatedPreds = allPreds.filter((p) => p.evaluated)
  const totalProdePoints = evaluatedPreds.reduce(
    (acc, p) => acc + (p.points_earned ?? 0),
    0
  )
  const totalMatches = matchesRaw?.length ?? 0
  const predictedCount = allPreds.length

  const matches = (matchesRaw ?? []) as Match[]
  const grouped = groupByDate(matches)

  // ── UI ────────────────────────────────────────────────────

  const FILTERS: Filter[] = ['upcoming', 'live', 'finished', 'all']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-3xl font-black text-white uppercase tracking-widest"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Prode
          </h1>
          <p className="text-gris-texto text-sm mt-1">
            Predecí los partidos del Mundial 2026
          </p>
        </div>

        {/* Puntos Prode */}
        <div className="bg-verde-medio border border-verde-borde rounded-lg px-5 py-3 text-right">
          <div className="text-gris-texto text-xs uppercase tracking-widest">
            Mis pts Prode
          </div>
          <div
            className="text-dorado text-2xl font-black"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            {totalProdePoints}
          </div>
          <div className="text-gris-texto text-xs">
            {predictedCount} predichos
          </div>
        </div>
      </div>

      {/* Tabs de filtro */}
      <div className="flex gap-1 bg-verde-medio border border-verde-borde rounded-lg p-1 w-fit">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/prode?filter=${f}`}
            className={`
              px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors
              ${filter === f
                ? 'bg-dorado text-verde-oscuro'
                : 'text-gris-texto hover:text-white'
              }
            `}
            style={filter === f ? { fontFamily: 'Arial Black, Arial, sans-serif' } : {}}
          >
            {filterLabel(f)}
          </Link>
        ))}
      </div>

      {/* Lista de partidos agrupados por fecha */}
      {grouped.size === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([dateLabel, dayMatches]) => (
            <div key={dateLabel}>
              {/* Cabecera de fecha */}
              <div className="flex items-center gap-4 mb-4">
                <h2
                  className="text-gris-texto text-xs font-black uppercase tracking-widest capitalize"
                  style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                >
                  {dateLabel}
                </h2>
                <div className="flex-1 h-px bg-verde-borde" />
                <span className="text-gris-texto text-xs">
                  {dayMatches.length} partido{dayMatches.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dayMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    prediction={predMap.get(match.id) ?? null}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Estado vacío ─────────────────────────────────────────────

function EmptyState({ filter }: { filter: Filter }) {
  const messages: Record<Filter, { icon: string; title: string; desc: string }> = {
    upcoming: {
      icon: '🎯',
      title: 'No hay partidos próximos',
      desc: 'Todos los partidos ya comenzaron o no hay fechas cargadas.',
    },
    live: {
      icon: '⚽',
      title: 'No hay partidos en vivo',
      desc: 'Volvé cuando empiece el próximo partido.',
    },
    finished: {
      icon: '📋',
      title: 'No hay partidos finalizados',
      desc: 'Todavía no se jugó ningún partido.',
    },
    all: {
      icon: '📅',
      title: 'No hay partidos cargados',
      desc: 'El fixture todavía no fue cargado.',
    },
  }

  const { icon, title, desc } = messages[filter]

  return (
    <div className="text-center py-20 bg-verde-medio border border-verde-borde rounded-lg">
      <p className="text-5xl mb-4">{icon}</p>
      <p
        className="text-white font-black uppercase tracking-widest text-lg mb-2"
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
      >
        {title}
      </p>
      <p className="text-gris-texto text-sm">{desc}</p>
    </div>
  )
}
