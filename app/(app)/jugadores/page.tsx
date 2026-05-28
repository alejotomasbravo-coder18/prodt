import { createClient } from '@/lib/supabase/server'
import CountrySelect from '@/components/jugadores/country-select'
import Link from 'next/link'

// ── Tipos ─────────────────────────────────────────────────────

interface PlayerRow {
  id: number
  name: string
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  country_id: number | null
  country: {
    name: string
    code: string
    flag_url: string | null
    eliminated: boolean
  } | null
  total_points: number
  total_goals: number
  total_assists: number
  total_clean_sheets: number
  matches_played: number
}

type PositionFilter = 'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD'

const POSITION_LABELS: Record<string, string> = {
  ALL: 'Todos',
  GK:  'ARQ',
  DEF: 'DEF',
  MID: 'MED',
  FWD: 'DEL',
}

const POSITION_COLORS: Record<string, string> = {
  GK:  'bg-yellow-400/20 text-yellow-300 border-yellow-500/30',
  DEF: 'bg-green-400/20 text-green-300 border-green-500/30',
  MID: 'bg-blue-400/20 text-blue-300 border-blue-500/30',
  FWD: 'bg-red-400/20 text-red-300 border-red-500/30',
}

// ── Page ──────────────────────────────────────────────────────

export default async function JugadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ pos?: string; pais?: string }>
}) {
  const { pos, pais } = await searchParams
  const posFilter = (['GK', 'DEF', 'MID', 'FWD'].includes(pos ?? '') ? pos : 'ALL') as PositionFilter
  const countryFilter = pais ? parseInt(pais) : null

  const supabase = await createClient()

  // ── Jugadores activos con puntos acumulados ───────────────
  // player_match_points es pública → no necesita service client
  const { data: playerPointsRaw } = await supabase
    .from('player_match_points')
    .select('player_id, raw_points, goals, assists, clean_sheet, minutes_played')

  // Agregar por jugador
  const agg = new Map<number, {
    total_points: number
    total_goals: number
    total_assists: number
    total_clean_sheets: number
    matches_played: number
  }>()
  for (const row of playerPointsRaw ?? []) {
    const prev = agg.get(row.player_id) ?? {
      total_points: 0,
      total_goals: 0,
      total_assists: 0,
      total_clean_sheets: 0,
      matches_played: 0,
    }
    agg.set(row.player_id, {
      total_points:       prev.total_points + (row.raw_points ?? 0),
      total_goals:        prev.total_goals + (row.goals ?? 0),
      total_assists:      prev.total_assists + (row.assists ?? 0),
      total_clean_sheets: prev.total_clean_sheets + (row.clean_sheet ? 1 : 0),
      matches_played:     prev.matches_played + ((row.minutes_played ?? 0) > 0 ? 1 : 0),
    })
  }

  // ── Jugadores ─────────────────────────────────────────────
  let playersQuery = supabase
    .from('players')
    .select(`
      id, name, position, country_id,
      country:countries (name, code, flag_url, eliminated)
    `)
    .eq('is_active', true)

  if (posFilter !== 'ALL') {
    playersQuery = playersQuery.eq('position', posFilter)
  }
  if (countryFilter) {
    playersQuery = playersQuery.eq('country_id', countryFilter)
  }

  const { data: playersRaw } = await playersQuery

  // Combinar con stats acumuladas y ordenar por puntos
  const players: PlayerRow[] = (playersRaw ?? [])
    .map((p) => {
      const stats = agg.get(p.id) ?? {
        total_points: 0,
        total_goals: 0,
        total_assists: 0,
        total_clean_sheets: 0,
        matches_played: 0,
      }
      return { ...p, ...stats, country: p.country as PlayerRow['country'] } as PlayerRow
    })
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      return a.name.localeCompare(b.name)
    })

  // ── Países para el filtro ─────────────────────────────────
  const { data: countriesRaw } = await supabase
    .from('countries')
    .select('id, name, code')
    .order('name', { ascending: true })

  const hasStats = players.some((p) => p.total_points > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-black text-white uppercase tracking-widest"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          Rendimiento Jugadores
        </h1>
        <p className="text-gris-texto text-sm mt-1">
          Puntos acumulados en el torneo · actualizado tras cada fecha publicada
        </p>
      </div>

      {/* Filtros + link comparador */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Link
          href="/jugadores/comparar"
          className="shrink-0 border border-dorado/60 text-dorado text-xs font-black uppercase tracking-widest px-4 py-2 rounded hover:bg-dorado hover:text-verde-oscuro transition-all"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          ⚖ Comparar jugadores
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Posición */}
        <div className="flex bg-verde-medio border border-verde-borde rounded-lg overflow-hidden">
          {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as PositionFilter[]).map((p) => (
            <a
              key={p}
              href={buildUrl({ pos: p === 'ALL' ? undefined : p, pais: countryFilter ?? undefined })}
              className={`px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                posFilter === p
                  ? 'bg-dorado text-verde-oscuro'
                  : 'text-gris-texto hover:text-white'
              }`}
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              {POSITION_LABELS[p]}
            </a>
          ))}
        </div>

        {/* País */}
        <CountrySelect
          countries={countriesRaw ?? []}
          currentCountry={countryFilter}
          currentPos={posFilter}
        />
      </div>

      {/* Tabla */}
      {!hasStats ? (
        <div className="bg-verde-medio border border-verde-borde rounded-lg px-5 py-10 text-center">
          <p className="text-gris-texto text-sm">
            Todavía no se publicaron puntos para ningún partido.
          </p>
          <p className="text-gris-texto text-xs mt-1">
            Los puntos aparecen después de que el admin publica los resultados de cada fecha.
          </p>
        </div>
      ) : (
        <div className="bg-verde-medio border border-verde-borde rounded-lg overflow-hidden">
          {/* Cabecera de tabla */}
          <div
            className="grid text-xs font-black uppercase tracking-widest text-gris-texto px-4 py-2.5"
            style={{
              gridTemplateColumns: '2.5rem 1fr 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem',
              fontFamily: 'Arial Black, Arial, sans-serif',
              borderBottom: '1px solid #1a3b1e',
            }}
          >
            <span>#</span>
            <span>Jugador</span>
            <span className="text-right">PTS</span>
            <span className="text-right">⚽</span>
            <span className="text-right">🅰️</span>
            <span className="text-right">🧤</span>
            <span className="text-right">PJ</span>
          </div>

          {/* Filas */}
          {players.map((player, idx) => (
            <div
              key={player.id}
              className="grid items-center px-4 py-3 border-b border-verde-borde last:border-0 hover:bg-verde-cancha/10 transition-colors"
              style={{
                gridTemplateColumns: '2.5rem 1fr 3.5rem 3.5rem 3.5rem 3.5rem 3.5rem',
              }}
            >
              {/* Rank */}
              <span
                className={`text-sm font-black tabular-nums ${
                  idx === 0 ? 'text-dorado' :
                  idx === 1 ? 'text-white/70' :
                  idx === 2 ? 'text-amber-600' :
                  'text-gris-texto'
                }`}
                style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
              >
                {idx + 1}
              </span>

              {/* Jugador */}
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Bandera */}
                <div className="shrink-0 w-7">
                  {player.country?.flag_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={player.country.flag_url}
                      alt={player.country.code}
                      className="w-6 h-auto rounded-sm"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-6 h-4 bg-verde-borde rounded flex items-center justify-center">
                      <span className="text-gris-texto" style={{ fontSize: '8px' }}>
                        {player.country?.code?.slice(0, 2) ?? '?'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="text-white text-sm font-bold truncate flex items-center gap-1.5">
                    {player.name}
                    {player.country?.eliminated && (
                      <span className="text-xs text-red-400 font-normal shrink-0">✗</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-black px-1.5 py-0 rounded border ${POSITION_COLORS[player.position]}`}
                      style={{ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '9px' }}
                    >
                      {POSITION_LABELS[player.position]}
                    </span>
                    <span className="text-gris-texto text-xs truncate">
                      {player.country?.name ?? '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <span
                className={`text-right text-sm font-black tabular-nums ${
                  player.total_points > 0 ? 'text-dorado' : 'text-gris-texto'
                }`}
                style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
              >
                {player.total_points}
              </span>
              <span className="text-right text-sm tabular-nums text-white/80">
                {player.total_goals || '—'}
              </span>
              <span className="text-right text-sm tabular-nums text-white/80">
                {player.total_assists || '—'}
              </span>
              <span className="text-right text-sm tabular-nums text-white/80">
                {player.total_clean_sheets || '—'}
              </span>
              <span className="text-right text-sm tabular-nums text-gris-texto">
                {player.matches_played || '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Leyenda */}
      <p className="text-gris-texto text-xs">
        PTS = puntos acumulados · ⚽ goles · 🅰️ asistencias · 🧤 vallas invictas · PJ partidos jugados
        {posFilter === 'ALL' && ' · ✗ selección eliminada'}
      </p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function buildUrl({ pos, pais }: { pos?: string; pais?: number }) {
  const params = new URLSearchParams()
  if (pos) params.set('pos', pos)
  if (pais) params.set('pais', String(pais))
  const qs = params.toString()
  return `/jugadores${qs ? `?${qs}` : ''}`
}

