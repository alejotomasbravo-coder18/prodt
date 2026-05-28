import { createClient, createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ liga?: string }>
}

export default async function RankingPage({ searchParams }: PageProps) {
  const { liga: ligaParam } = await searchParams
  const selectedLeagueId = ligaParam ? parseInt(ligaParam) : null

  const supabase = await createClient()
  // Service client para leer league_members y league_ranking sin RLS circular
  const supa = createServiceClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Ligas del usuario (service client para bypasear RLS circular de league_members)
  const { data: memberships } = await supa
    .from('league_members')
    .select('league_id, league:leagues(id, name)')
    .eq('user_id', user!.id)

  const myLeagues = (memberships ?? []).map((m) => ({
    id: (m.league as { id: number; name: string }).id,
    name: (m.league as { id: number; name: string }).name,
  }))

  // Ranking global (security_invoker=false en la vista → no necesita service)
  const { data: globalRanking } = await supabase
    .from('global_ranking')
    .select('rank, user_id, username, display_name, gran_dt_total, prode_total, total_points')
    .order('rank', { ascending: true })
    .limit(100)

  // Campeones globales (is_global_champion en profiles)
  const { data: champions } = await supa
    .from('profiles')
    .select('id')
    .eq('is_global_champion', true)
  const globalChampionIds = new Set((champions ?? []).map((c) => c.id))

  // Campeones de la liga seleccionada
  const { data: leagueChampions } = selectedLeagueId
    ? await supa
        .from('league_members')
        .select('user_id')
        .eq('league_id', selectedLeagueId)
        .eq('is_league_champion', true)
    : { data: [] }
  const leagueChampionIds = new Set((leagueChampions ?? []).map((c) => c.user_id))

  // Ranking de liga seleccionada
  let leagueRanking: {
    rank: number
    user_id: string
    username: string
    display_name: string | null
    total_points: number
  }[] = []

  let selectedLeague: { id: number; name: string } | null = null

  if (selectedLeagueId) {
    const found = myLeagues.find((l) => l.id === selectedLeagueId)
    selectedLeague = found ?? null

    if (selectedLeague) {
      // service client: league_ranking lee user_match_scores de todos los usuarios
      const { data: lr } = await supa
        .from('league_ranking')
        .select('rank, user_id, username, display_name, total_points')
        .eq('league_id', selectedLeagueId)
        .order('rank', { ascending: true })

      leagueRanking = (lr ?? []) as typeof leagueRanking
    }
  }

  const currentRanking = selectedLeagueId && selectedLeague
    ? leagueRanking
    : (globalRanking ?? [])

  const myGlobalRow = globalRanking?.find((r) => r.user_id === user!.id)
  const myLeagueRow = leagueRanking.find((r) => r.user_id === user!.id)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-3xl font-black text-white uppercase tracking-widest"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Ranking
          </h1>
          <p className="text-gris-texto text-sm mt-1">
            {selectedLeague ? selectedLeague.name : 'Global · Top 100'}
          </p>
        </div>

        {/* Mi posición — global */}
        {myGlobalRow && !selectedLeagueId && (
          <div className="bg-verde-medio border border-dorado/30 rounded-lg px-4 py-3 text-right">
            <div className="text-gris-texto text-xs uppercase tracking-widest">Tu posición</div>
            <div
              className="text-dorado text-xl font-black mt-0.5"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              #{myGlobalRow.rank}
            </div>
            <div className="text-white text-xs mt-0.5">{myGlobalRow.total_points} pts</div>
          </div>
        )}
        {/* Mi posición — liga */}
        {myLeagueRow && selectedLeagueId && (
          <div className="bg-verde-medio border border-dorado/30 rounded-lg px-4 py-3 text-right">
            <div className="text-gris-texto text-xs uppercase tracking-widest">Tu posición</div>
            <div
              className="text-dorado text-xl font-black mt-0.5"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              #{myLeagueRow.rank}
            </div>
            <div className="text-white text-xs mt-0.5">{myLeagueRow.total_points} pts</div>
          </div>
        )}
      </div>

      {/* Selector de liga */}
      <div className="flex gap-2 flex-wrap">
        <Link
          href="/ranking"
          className={`
            text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded transition-colors
            ${!selectedLeagueId
              ? 'bg-dorado text-verde-oscuro'
              : 'bg-verde-medio border border-verde-borde text-gris-texto hover:text-white'
            }
          `}
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          Global
        </Link>
        {myLeagues.map((l) => (
          <Link
            key={l.id}
            href={`/ranking?liga=${l.id}`}
            className={`
              text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded transition-colors
              ${selectedLeagueId === l.id
                ? 'bg-dorado text-verde-oscuro'
                : 'bg-verde-medio border border-verde-borde text-gris-texto hover:text-white'
              }
            `}
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            {l.name}
          </Link>
        ))}
        {myLeagues.length === 0 && (
          <Link
            href="/liga"
            className="text-xs text-dorado border border-dorado/30 rounded px-3 py-1.5 hover:bg-dorado/10 transition-colors"
          >
            + Unirme a una liga
          </Link>
        )}
      </div>

      {/* Tabla */}
      {currentRanking.length > 0 ? (
        <div className="bg-verde-medio border border-verde-borde rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '2px solid #c8a84b' }}>
                <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-dorado w-12">
                  #
                </th>
                <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-gris-texto">
                  Jugador
                </th>
                {!selectedLeagueId && (
                  <>
                    <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest text-gris-texto hidden sm:table-cell">
                      Gran DT
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest text-gris-texto hidden sm:table-cell">
                      Prode
                    </th>
                  </>
                )}
                <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-widest text-dorado">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {currentRanking.map((row, idx) => {
                const isMe = row.user_id === user!.id
                const globalRow = globalRanking?.find((g) => g.user_id === row.user_id)
                const isGlobalChamp = globalChampionIds.has(row.user_id)
                const isLeagueChamp = leagueChampionIds.has(row.user_id)

                return (
                  <tr
                    key={row.user_id}
                    className={`
                      border-b border-verde-borde last:border-0
                      ${isGlobalChamp || isLeagueChamp ? 'bg-dorado/10' : isMe ? 'bg-dorado/5' : idx < 3 ? 'bg-verde-oscuro/30' : ''}
                    `}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-black ${
                          idx === 0 ? 'text-yellow-400' :
                          idx === 1 ? 'text-gray-300' :
                          idx === 2 ? 'text-orange-400' :
                          'text-gris-texto'
                        }`}
                      >
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : row.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-bold">
                          {row.display_name || row.username}
                        </span>
                        {isGlobalChamp && (
                          <span
                            className="text-xs font-black px-2 py-0.5 rounded animate-pulse"
                            style={{ background: '#c8a84b', color: '#0d1f0f', fontFamily: 'Arial Black, Arial, sans-serif' }}
                            title="Gran Campeón Mundial 2026"
                          >
                            🏆 GRAN CAMPEÓN
                          </span>
                        )}
                        {isLeagueChamp && !isGlobalChamp && (
                          <span
                            className="text-xs font-black px-2 py-0.5 rounded"
                            style={{ background: '#1a3b6e', color: '#c8a84b', fontFamily: 'Arial Black, Arial, sans-serif' }}
                            title="Campeón de Liga"
                          >
                            🥇 CAMPEÓN DE LIGA
                          </span>
                        )}
                        {isMe && (
                          <span className="text-xs bg-dorado text-verde-oscuro font-black px-1.5 py-0.5 rounded">
                            Vos
                          </span>
                        )}
                      </div>
                      <span className="text-gris-texto text-xs">@{row.username}</span>
                    </td>
                    {!selectedLeagueId && (
                      <>
                        <td className="px-4 py-3 text-right text-sm text-white hidden sm:table-cell">
                          {(globalRow as { gran_dt_total?: number })?.gran_dt_total ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-white hidden sm:table-cell">
                          {(globalRow as { prode_total?: number })?.prode_total ?? 0}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right">
                      <span
                        className="text-dorado font-black text-sm"
                        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                      >
                        {row.total_points}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 bg-verde-medio border border-verde-borde rounded-lg">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-gris-texto">
            {selectedLeague
              ? 'Todavía no hay puntos en esta liga.'
              : 'Todavía no hay puntos publicados.'}
          </p>
          {selectedLeague && (
            <p className="text-gris-texto text-xs mt-1">
              Los puntos aparecen cuando el admin publica los resultados de un partido.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
