import { createClient } from '@/lib/supabase/server'
import PlayerComparatorPicker from '@/components/jugadores/player-comparator-picker'
import Link from 'next/link'

// ── Tipos ─────────────────────────────────────────────────────

interface PlayerStats {
  id: number
  name: string
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  country_name: string | null
  country_code: string | null
  flag_url: string | null
  total_points: number
  total_goals: number
  total_assists: number
  total_clean_sheets: number
  total_yellow_cards: number
  total_red_cards: number
  total_own_goals: number
  is_mvp_count: number
  matches_played: number
  minutes_played: number
}

const POS_LABELS: Record<string, string> = {
  GK: 'Arquero', DEF: 'Defensor', MID: 'Mediocampista', FWD: 'Delantero',
}

// ── Stat row con indicador de ventaja ────────────────────────

function StatRow({
  label,
  valA,
  valB,
  higherIsBetter = true,
  format,
}: {
  label: string
  valA: number
  valB: number
  higherIsBetter?: boolean
  format?: (v: number) => string
}) {
  const fmt = format ?? ((v: number) => String(v))
  const aWins = higherIsBetter ? valA > valB : valA < valB
  const bWins = higherIsBetter ? valB > valA : valB < valA
  const tied  = valA === valB

  return (
    <div className="grid items-center border-b border-verde-borde last:border-0 py-2.5 px-4"
      style={{ gridTemplateColumns: '1fr 10rem 1fr' }}>
      {/* Valor A */}
      <div className={`text-right text-sm font-black tabular-nums ${
        aWins ? 'text-green-400' : tied ? 'text-white' : 'text-white/50'
      }`}
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}>
        {aWins && <span className="mr-1.5 text-xs">▶</span>}
        {fmt(valA)}
      </div>

      {/* Etiqueta */}
      <div className="text-center text-gris-texto text-xs font-bold uppercase tracking-widest px-2">
        {label}
      </div>

      {/* Valor B */}
      <div className={`text-left text-sm font-black tabular-nums ${
        bWins ? 'text-green-400' : tied ? 'text-white' : 'text-white/50'
      }`}
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}>
        {fmt(valB)}
        {bWins && <span className="ml-1.5 text-xs">◀</span>}
      </div>
    </div>
  )
}

// ── Header del jugador ────────────────────────────────────────

function PlayerHeader({ player, side }: { player: PlayerStats; side: 'A' | 'B' }) {
  return (
    <div className={`flex-1 text-center p-4 border-b border-verde-borde ${
      side === 'A' ? 'border-r' : ''
    }`}>
      {player.flag_url && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={player.flag_url}
          alt={player.country_code ?? ''}
          className="w-10 h-auto rounded mx-auto mb-2"
        />
      )}
      <div className="text-white font-black text-base leading-tight"
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}>
        {player.name}
      </div>
      <div className="text-gris-texto text-xs mt-0.5">
        {player.country_name} · {POS_LABELS[player.position] ?? player.position}
      </div>
      <div className="text-dorado font-black text-2xl mt-2"
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}>
        {player.total_points}
        <span className="text-gris-texto text-sm font-normal ml-1">pts</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default async function ComparadorPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>
}) {
  const { a, b } = await searchParams
  const idA = a ? parseInt(a) : null
  const idB = b ? parseInt(b) : null

  const supabase = await createClient()

  // ── Todos los jugadores activos (para el picker) ──────────
  const { data: playersRaw } = await supabase
    .from('players')
    .select(`
      id, name, position, country_id,
      country:countries (name, code, flag_url)
    `)
    .eq('is_active', true)
    .order('name')

  // ── Puntos acumulados por jugador ─────────────────────────
  const { data: allPoints } = await supabase
    .from('player_match_points')
    .select('player_id, raw_points, goals, assists, clean_sheet, yellow_cards, red_card, own_goals, is_mvp, minutes_played')

  // Agregar stats por jugador
  const statsMap = new Map<number, Omit<PlayerStats, 'id' | 'name' | 'position' | 'country_name' | 'country_code' | 'flag_url'>>()

  for (const row of allPoints ?? []) {
    const prev = statsMap.get(row.player_id) ?? {
      total_points: 0, total_goals: 0, total_assists: 0,
      total_clean_sheets: 0, total_yellow_cards: 0, total_red_cards: 0,
      total_own_goals: 0, is_mvp_count: 0, matches_played: 0, minutes_played: 0,
    }
    statsMap.set(row.player_id, {
      total_points:       prev.total_points + (row.raw_points ?? 0),
      total_goals:        prev.total_goals + (row.goals ?? 0),
      total_assists:      prev.total_assists + (row.assists ?? 0),
      total_clean_sheets: prev.total_clean_sheets + (row.clean_sheet ? 1 : 0),
      total_yellow_cards: prev.total_yellow_cards + (row.yellow_cards ?? 0),
      total_red_cards:    prev.total_red_cards + (row.red_card ? 1 : 0),
      total_own_goals:    prev.total_own_goals + (row.own_goals ?? 0),
      is_mvp_count:       prev.is_mvp_count + (row.is_mvp ? 1 : 0),
      matches_played:     prev.matches_played + ((row.minutes_played ?? 0) > 0 ? 1 : 0),
      minutes_played:     prev.minutes_played + (row.minutes_played ?? 0),
    })
  }

  // Construir la lista de opciones para el picker
  const playerOptions = (playersRaw ?? []).map((p) => {
    const stats = statsMap.get(p.id)
    const country = p.country as unknown as { name: string; code: string; flag_url: string | null } | null
    return {
      id: p.id,
      name: p.name,
      position: p.position,
      country_name: country?.name ?? null,
      flag_url: country?.flag_url ?? null,
      total_points: stats?.total_points ?? 0,
    }
  })

  // Construir stats completas de los dos jugadores seleccionados
  function buildPlayerStats(id: number): PlayerStats | null {
    const raw = playersRaw?.find((p) => p.id === id)
    if (!raw) return null
    const stats = statsMap.get(id)
    const country = raw.country as unknown as { name: string; code: string; flag_url: string | null } | null
    return {
      id,
      name: raw.name,
      position: raw.position as PlayerStats['position'],
      country_name: country?.name ?? null,
      country_code: country?.code ?? null,
      flag_url: country?.flag_url ?? null,
      total_points:       stats?.total_points       ?? 0,
      total_goals:        stats?.total_goals         ?? 0,
      total_assists:      stats?.total_assists       ?? 0,
      total_clean_sheets: stats?.total_clean_sheets  ?? 0,
      total_yellow_cards: stats?.total_yellow_cards  ?? 0,
      total_red_cards:    stats?.total_red_cards     ?? 0,
      total_own_goals:    stats?.total_own_goals     ?? 0,
      is_mvp_count:       stats?.is_mvp_count        ?? 0,
      matches_played:     stats?.matches_played      ?? 0,
      minutes_played:     stats?.minutes_played      ?? 0,
    }
  }

  const playerA = idA ? buildPlayerStats(idA) : null
  const playerB = idB ? buildPlayerStats(idB) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <h1
            className="text-3xl font-black text-white uppercase tracking-widest"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Comparador
          </h1>
          <p className="text-gris-texto text-sm mt-1">
            Compará el rendimiento de dos jugadores en el torneo
          </p>
        </div>
        <Link
          href="/jugadores"
          className="ml-auto text-gris-texto hover:text-white text-xs transition-colors"
        >
          ← Volver a Jugadores
        </Link>
      </div>

      {/* Picker */}
      <div className="bg-verde-medio border border-verde-borde rounded-lg p-5">
        <PlayerComparatorPicker
          players={playerOptions}
          initialA={idA}
          initialB={idB}
        />
      </div>

      {/* Comparación */}
      {playerA && playerB ? (
        <div className="bg-verde-medio border border-verde-borde rounded-lg overflow-hidden">
          {/* Headers */}
          <div className="flex border-b border-verde-borde" style={{ borderBottomWidth: '2px', borderColor: '#c8a84b' }}>
            <PlayerHeader player={playerA} side="A" />
            <PlayerHeader player={playerB} side="B" />
          </div>

          {/* Stats */}
          <div>
            <StatRow label="Puntos"        valA={playerA.total_points}       valB={playerB.total_points} />
            <StatRow label="Goles"         valA={playerA.total_goals}        valB={playerB.total_goals} />
            <StatRow label="Asistencias"   valA={playerA.total_assists}      valB={playerB.total_assists} />
            <StatRow label="MVP"           valA={playerA.is_mvp_count}       valB={playerB.is_mvp_count} />
            {(playerA.position === 'GK' || playerA.position === 'DEF' ||
              playerB.position === 'GK' || playerB.position === 'DEF') && (
              <StatRow label="Valla invicta" valA={playerA.total_clean_sheets} valB={playerB.total_clean_sheets} />
            )}
            <StatRow label="Amarillas"     valA={playerA.total_yellow_cards} valB={playerB.total_yellow_cards} higherIsBetter={false} />
            <StatRow label="Rojas"         valA={playerA.total_red_cards}    valB={playerB.total_red_cards}    higherIsBetter={false} />
            <StatRow label="Autogoles"     valA={playerA.total_own_goals}    valB={playerB.total_own_goals}    higherIsBetter={false} />
            <StatRow label="Partidos"      valA={playerA.matches_played}     valB={playerB.matches_played} />
            <StatRow
              label="Minutos"
              valA={playerA.minutes_played}
              valB={playerB.minutes_played}
              format={(v) => `${v}'`}
            />
          </div>
        </div>
      ) : (
        <div className="bg-verde-medio border border-verde-borde rounded-lg px-5 py-10 text-center">
          <p className="text-gris-texto text-sm">
            Seleccioná dos jugadores para comparar su rendimiento en el torneo.
          </p>
        </div>
      )}
    </div>
  )
}
