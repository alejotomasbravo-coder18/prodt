/**
 * TopPicksWidget — Jugadores más elegidos en tu liga
 *
 * Muestra los titulares (slots 1-11) más seleccionados por los managers
 * de las ligas del usuario. Solo datos agregados: no revela qué
 * jugador específico tiene cada usuario (privacidad de equipos OK).
 *
 * Requiere service client porque user_team_players tiene RLS.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

interface TopPicksWidgetProps {
  userId: string
}

interface TopPick {
  player_id: number
  player_name: string
  position: string
  country_name: string | null
  flag_url: string | null
  pick_count: number
  pick_pct: number   // porcentaje de managers que lo tienen
}

const POS_SHORT: Record<string, string> = {
  GK: 'ARQ', DEF: 'DEF', MID: 'MED', FWD: 'DEL',
}
const POS_COLORS: Record<string, string> = {
  GK:  '#facc15',
  DEF: '#4ade80',
  MID: '#60a5fa',
  FWD: '#f87171',
}

export default async function TopPicksWidget({ userId }: TopPicksWidgetProps) {
  const supabase = await createClient()
  const supa     = createServiceClient()

  // ── 1. Ligas del usuario ─────────────────────────────────
  const { data: myLeagues } = await supa
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId)

  if (!myLeagues || myLeagues.length === 0) return null

  const leagueIds = myLeagues.map((l) => l.league_id)

  // ── 2. Todos los miembros de esas ligas ──────────────────
  const { data: allMembers } = await supa
    .from('league_members')
    .select('user_id')
    .in('league_id', leagueIds)

  const memberIds = [...new Set((allMembers ?? []).map((m) => m.user_id))]
  const totalManagers = memberIds.length

  if (totalManagers === 0) return null

  // ── 3. Equipos de esos managers ──────────────────────────
  const { data: teams } = await supa
    .from('user_teams')
    .select('id')
    .in('user_id', memberIds)

  const teamIds = (teams ?? []).map((t) => t.id)
  if (teamIds.length === 0) return null

  // ── 4. Picks de titulares (slots 1-11) ───────────────────
  const { data: picks } = await supa
    .from('user_team_players')
    .select('player_id')
    .in('user_team_id', teamIds)
    .gte('slot', 1)
    .lte('slot', 11)

  if (!picks || picks.length === 0) return null

  // ── 5. Contar por jugador ────────────────────────────────
  const counts = new Map<number, number>()
  for (const p of picks) {
    if (p.player_id) {
      counts.set(p.player_id, (counts.get(p.player_id) ?? 0) + 1)
    }
  }

  // Top 10 por count
  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  if (topIds.length === 0) return null

  // ── 6. Datos de los jugadores ────────────────────────────
  const { data: playersRaw } = await supabase
    .from('players')
    .select('id, name, position, country:countries(name, flag_url)')
    .in('id', topIds)

  const playerMap = new Map(
    (playersRaw ?? []).map((p) => [p.id, p])
  )

  const topPicks: TopPick[] = topIds
    .map((id) => {
      const p = playerMap.get(id)
      if (!p) return null
      const count = counts.get(id) ?? 0
      const country = p.country as { name: string; flag_url: string | null } | null
      return {
        player_id:   id,
        player_name: p.name,
        position:    p.position,
        country_name: country?.name ?? null,
        flag_url:     country?.flag_url ?? null,
        pick_count:  count,
        pick_pct:    Math.round((count / totalManagers) * 100),
      }
    })
    .filter((x): x is TopPick => x !== null)

  if (topPicks.length === 0) return null

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-xs font-black uppercase tracking-widest text-gris-texto"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          Más elegidos en tu liga
        </h2>
        <span className="text-gris-texto text-xs">
          {totalManagers} manager{totalManagers !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista */}
      <div className="bg-verde-medio border border-verde-borde rounded-lg overflow-hidden">
        {topPicks.map((pick, idx) => (
          <div
            key={pick.player_id}
            className="flex items-center gap-3 px-4 py-3 border-b border-verde-borde last:border-0"
          >
            {/* Rank */}
            <span
              className={`text-xs font-black w-5 shrink-0 tabular-nums ${
                idx === 0 ? 'text-dorado' :
                idx === 1 ? 'text-white/60' :
                idx === 2 ? 'text-amber-600' :
                'text-gris-texto'
              }`}
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              {idx + 1}
            </span>

            {/* Bandera */}
            <div className="w-7 shrink-0">
              {pick.flag_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={pick.flag_url} alt="" className="w-6 h-auto rounded-sm" loading="lazy" />
              ) : (
                <div className="w-6 h-4 bg-verde-borde rounded" />
              )}
            </div>

            {/* Nombre */}
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-bold truncate">
                {pick.player_name}
              </div>
              <div className="text-gris-texto text-xs">{pick.country_name}</div>
            </div>

            {/* Posición */}
            <span
              className="shrink-0 text-xs font-black px-1.5 py-0.5 rounded"
              style={{
                background: POS_COLORS[pick.position] ?? '#c8a84b',
                color: '#0d1f0f',
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '9px',
              }}
            >
              {POS_SHORT[pick.position] ?? pick.position}
            </span>

            {/* Barra de ownership */}
            <div className="w-20 shrink-0">
              <div className="flex items-center justify-end gap-1.5">
                <div className="flex-1 h-1.5 bg-verde-borde rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-dorado"
                    style={{ width: `${pick.pick_pct}%` }}
                  />
                </div>
                <span
                  className="text-xs font-black text-dorado tabular-nums w-8 text-right"
                  style={{ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '10px' }}
                >
                  {pick.pick_pct}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-gris-texto text-xs">
        % de managers que incluyen al jugador como titular en su 11.
      </p>
    </section>
  )
}
