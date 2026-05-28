import { createClient, createServiceClient } from '@/lib/supabase/server'
import CreateLeagueForm from '@/components/liga/create-league-form'
import JoinLeagueForm from '@/components/liga/join-league-form'
import LeagueCard from '@/components/liga/league-card'
import TopPicksWidget from '@/components/liga/top-picks-widget'

interface RankingRow {
  user_id: string
  username: string
  display_name: string | null
  total_points: number
  rank: number
}

export default async function LigaPage() {
  // Auth: solo con el cliente normal (cookie-based)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Todas las lecturas de DB con service client para bypasear RLS
  // en leagues y league_members (politicas circulares / chicken-and-egg)
  const supa = createServiceClient()

  // Mis ligas con info de membresia
  const { data: memberships } = await supa
    .from('league_members')
    .select(`
      role,
      league:leagues (
        id, name, invite_code, rules_text, prizes_text, created_by
      )
    `)
    .eq('user_id', user!.id)
    .order('joined_at', { ascending: false })

  // Para cada liga: count de miembros + ranking completo
  const leaguesWithStats = await Promise.all(
    (memberships ?? []).map(async (m) => {
      const league = m.league as {
        id: number
        name: string
        invite_code: string
        rules_text: string | null
        prizes_text: string | null
        created_by: string
      }

      // Count de miembros (service client: bypasa RLS circular)
      const { count: memberCount } = await supa
        .from('league_members')
        .select('id', { count: 'exact', head: true })
        .eq('league_id', league.id)

      // Ranking completo de la liga (service client: la vista
      // league_ranking necesita leer user_match_scores de todos)
      const { data: rankingRows } = await supa
        .from('league_ranking')
        .select('user_id, username, display_name, rank, total_points')
        .eq('league_id', league.id)
        .order('rank', { ascending: true })

      const typedRankingRows = (rankingRows ?? []) as RankingRow[]
      const myRankingRow = typedRankingRows.find((r) => r.user_id === user!.id)

      return {
        ...league,
        member_count: memberCount ?? 0,
        user_role: m.role as 'admin' | 'member',
        user_rank: myRankingRow?.rank ?? null,
        user_points: myRankingRow?.total_points ?? 0,
        ranking_rows: typedRankingRows,
      }
    })
  )

  const hasLeagues = leaguesWithStats.length > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-black text-white uppercase tracking-widest"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          Ligas
        </h1>
        <p className="text-gris-texto text-sm mt-1">
          Jugate contra tus amigos en ligas privadas
        </p>
      </div>

      {/* Mis ligas */}
      {hasLeagues ? (
        <section className="space-y-3">
          <h2
            className="text-xs font-black uppercase tracking-widest text-gris-texto"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Mis ligas ({leaguesWithStats.length})
          </h2>
          <div className="space-y-3">
            {leaguesWithStats.map((league) => (
              <LeagueCard
                key={league.id}
                league={league}
                currentUserId={user!.id}
                rankingRows={league.ranking_rows}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="bg-verde-medio border border-verde-borde rounded-lg px-5 py-8 text-center">
          <p className="text-gris-texto text-sm">
            Todavia no perteneces a ninguna liga.
          </p>
          <p className="text-gris-texto text-xs mt-1">
            Crea una o ingresa el codigo de invitacion de un amigo.
          </p>
        </div>
      )}

      {/* Formularios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Crear */}
        <section className="bg-verde-medio border border-verde-borde rounded-lg p-5 space-y-4">
          <div>
            <h2
              className="text-white font-black text-base uppercase tracking-widest"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              Crear liga
            </h2>
            <p className="text-gris-texto text-xs mt-0.5">
              Invita a tus amigos con el codigo generado
            </p>
          </div>
          <CreateLeagueForm />
        </section>

        {/* Unirse */}
        <section className="bg-verde-medio border border-verde-borde rounded-lg p-5 space-y-4">
          <div>
            <h2
              className="text-white font-black text-base uppercase tracking-widest"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              Unirse a liga
            </h2>
            <p className="text-gris-texto text-xs mt-0.5">
              Ingresa el codigo que te compartio un amigo
            </p>
          </div>
          <JoinLeagueForm />
        </section>
      </div>

      {/* Mas elegidos en tu liga */}
      {hasLeagues && <TopPicksWidget userId={user!.id} />}

      {/* Info Lazar */}
      <div
        className="rounded-lg px-5 py-3 flex items-center gap-3"
        style={{ background: '#0f2557', border: '1px solid #1a3b6e' }}
      >
        <span
          className="text-dorado font-black text-sm uppercase tracking-widest"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          LAZAR
        </span>
        <span className="text-white/50 text-xs">.</span>
        <span className="text-white/70 text-xs">
          El ganador de cada fecha en tu liga recibe +1 cambio extra en Gran DT
        </span>
      </div>
    </div>
  )
}
