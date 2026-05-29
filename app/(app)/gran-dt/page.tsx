import { createClient } from '@/lib/supabase/server'
import GranDTPitch from '@/components/gran-dt/pitch'
import type { Player, Country, Formation } from '@/lib/types'

export default async function GranDtPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Jugadores activos del torneo ──────────────────────────
  const { data: playersRaw } = await supabase
    .from('players')
    .select(`
      id, name, position, country_id, is_provisional, is_active,
      country:countries (id, name, code, flag_url, eliminated, eliminated_at)
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const allPlayers = (playersRaw ?? []) as unknown as (Player & { country?: Country })[]

  // ── Equipo actual del usuario ─────────────────────────────
  const { data: team } = await supabase
    .from('user_teams')
    .select('id, formation, captain_player_id, updated_at')
    .eq('user_id', user!.id)
    .single()

  let slotsMap = new Map<number, Player & { country?: Country }>()
  const hasExistingTeam = !!team

  if (team) {
    const { data: teamPlayers } = await supabase
      .from('user_team_players')
      .select(`
        slot,
        player:players (
          id, name, position, country_id, is_provisional, is_active,
          country:countries (id, name, code, flag_url, eliminated, eliminated_at)
        )
      `)
      .eq('user_team_id', team.id)

    for (const tp of teamPlayers ?? []) {
      if (tp.player) {
        slotsMap.set(tp.slot, tp.player as unknown as Player & { country?: Country })
      }
    }
  }

  // ── Balance de cambios ────────────────────────────────────
  const { data: balanceRow } = await supabase
    .from('user_transfer_balance')
    .select('available, total_used')
    .eq('user_id', user!.id)
    .single()

  const balance = balanceRow?.available ?? 0
  const totalUsed = balanceRow?.total_used ?? 0

  // ── Fase activa → límite por país ─────────────────────────
  const { data: phases } = await supabase
    .from('phases')
    .select('id, name, phase_order, max_per_country, started_at')
    .order('phase_order', { ascending: false })

  const activePhase =
    phases?.find((p) => p.started_at !== null) ??
    phases?.[phases.length - 1] ??
    null

  const maxPerCountry: number | null = activePhase?.max_per_country ?? 1

  // ── Países eliminados ─────────────────────────────────────
  const { data: eliminatedCountries } = await supabase
    .from('countries')
    .select('id')
    .eq('eliminated', true)

  const eliminatedIds = (eliminatedCountries ?? []).map((c) => c.id)

  // ── Deadline: ¿hay partido que ya empezó? ─────────────────
  const { data: nextMatch } = await supabase
    .from('matches')
    .select('kickoff_at, status')
    .in('status', ['scheduled', 'live'])
    .not('home_country_id', 'is', null)
    .order('kickoff_at', { ascending: true })
    .limit(1)
    .single()

  const deadlinePassed =
    !nextMatch ||
    nextMatch.status === 'live' ||
    new Date(nextMatch.kickoff_at) <= new Date()

  // ── Calcular puntos Gran DT del usuario ───────────────────
  const { data: matchScores } = await supabase
    .from('user_match_scores')
    .select('gran_dt_points, captain_bonus')
    .eq('user_id', user!.id)

  const totalGranDtPoints = (matchScores ?? []).reduce(
    (acc, s) => acc + (s.gran_dt_points ?? 0) + (s.captain_bonus ?? 0),
    0
  )

  // ── Rendimiento acumulado por jugador ─────────────────────
  // player_match_points es pública (no RLS), se puede leer con
  // el cliente normal. Agregamos raw_points por jugador.
  const { data: playerPointsRaw } = await supabase
    .from('player_match_points')
    .select('player_id, raw_points')

  const playerPoints = new Map<number, number>()
  for (const row of playerPointsRaw ?? []) {
    playerPoints.set(
      row.player_id,
      (playerPoints.get(row.player_id) ?? 0) + (row.raw_points ?? 0)
    )
  }

  const initialFormation: Formation = (team?.formation as Formation) ?? '4-4-2'
  const initialCaptainId: number | null = team?.captain_player_id ?? null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-3xl font-black text-white uppercase tracking-widest"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Gran DT
          </h1>
          <p className="text-gris-texto text-sm mt-1">
            Armá tu equipo del Mundial 2026 · {activePhase?.name ?? 'Fase de Grupos'}
          </p>
        </div>

        {/* Stats rápidas */}
        <div className="flex gap-3 flex-wrap">
          <StatBadge
            label="Pts Gran DT"
            value={String(totalGranDtPoints)}
            accent
          />
          {hasExistingTeam && (
            <StatBadge
              label="Cambios"
              value={String(balance)}
              note={totalUsed > 0 ? `${totalUsed} usados` : undefined}
            />
          )}
          {maxPerCountry !== null && (
            <StatBadge
              label="Límite país"
              value={`Max ${maxPerCountry}`}
            />
          )}
        </div>
      </div>

      {/* Instrucciones si no hay equipo */}
      {!hasExistingTeam && !deadlinePassed && (
        <div className="bg-verde-medio border border-dorado/30 rounded-lg px-5 py-4 flex items-start gap-3">
          <span className="text-dorado text-lg mt-0.5">💡</span>
          <div>
            <p className="text-white text-sm font-bold mb-1">
              Armá tu equipo antes del primer partido
            </p>
            <p className="text-gris-texto text-xs leading-relaxed">
              Tocá cada slot en la cancha para elegir jugadores. Asigná un capitán (sus puntos se duplican).
              El equipo debe tener un jugador por posición y max {maxPerCountry} jugador{maxPerCountry !== 1 ? 'es' : ''} del mismo país.
            </p>
          </div>
        </div>
      )}

      {/* No hay jugadores en la DB */}
      {allPlayers.length === 0 && (
        <div className="bg-red-950/40 border border-red-800 rounded-lg px-5 py-4">
          <p className="text-red-300 text-sm font-bold">
            No hay jugadores cargados en la base de datos.
          </p>
          <p className="text-red-400 text-xs mt-1">
            Un admin debe cargar los jugadores provisorios en la tabla <code>players</code>.
          </p>
        </div>
      )}

      {/* La cancha */}
      <GranDTPitch
        initialFormation={initialFormation}
        initialSlots={slotsMap}
        initialCaptainId={initialCaptainId}
        allPlayers={allPlayers}
        balance={balance}
        maxPerCountry={maxPerCountry}
        eliminatedCountryIds={eliminatedIds}
        deadlinePassed={deadlinePassed}
        hasExistingTeam={hasExistingTeam}
        playerPoints={playerPoints}
      />

      {/* Historial de cambios recientes */}
      {hasExistingTeam && (
        <TransferHistory userId={user!.id} />
      )}
    </div>
  )
}

// ── Sub-componentes server ────────────────────────────────────

async function TransferHistory({ userId }: { userId: string }) {
  const supabase = await createClient()

  const { data: transfers } = await supabase
    .from('transfers')
    .select(`
      id, transferred_at, is_free,
      player_out:players!player_out_id (name, position),
      player_in:players!player_in_id (name, position)
    `)
    .eq('user_id', userId)
    .order('transferred_at', { ascending: false })
    .limit(10)

  if (!transfers || transfers.length === 0) return null

  return (
    <div className="space-y-3">
      <h2
        className="text-xs font-black uppercase tracking-widest text-gris-texto"
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
      >
        Últimos cambios
      </h2>
      <div className="bg-verde-medio border border-verde-borde rounded-lg overflow-hidden">
        {transfers.map((t) => {
          const pOut = t.player_out as any
          const pIn  = t.player_in  as any
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-verde-borde last:border-0 text-sm"
            >
              <span className="text-red-400 font-bold flex-1 truncate">
                ↑ {pOut?.name ?? '—'}
              </span>
              <span className="text-green-400 font-bold flex-1 truncate">
                ↓ {pIn?.name ?? '—'}
              </span>
              <div className="shrink-0 text-right">
                {t.is_free ? (
                  <span className="text-gris-texto text-xs">Gratis</span>
                ) : (
                  <span className="text-dorado text-xs font-bold">-1 cambio</span>
                )}
                <div className="text-gris-texto text-xs">
                  {new Date(t.transferred_at).toLocaleDateString('es-AR')}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatBadge({
  label,
  value,
  accent,
  note,
}: {
  label: string
  value: string
  accent?: boolean
  note?: string
}) {
  return (
    <div className="bg-verde-medio border border-verde-borde rounded-lg px-4 py-3">
      <div className="text-gris-texto text-xs uppercase tracking-widest">{label}</div>
      <div
        className={`text-xl font-black mt-0.5 ${accent ? 'text-dorado' : 'text-white'}`}
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
      >
        {value}
      </div>
      {note && <div className="text-gris-texto text-xs">{note}</div>}
    </div>
  )
}
