import { createClient } from '@/lib/supabase/server'
import MatchEditForm from '@/components/admin/match-edit-form'

export default async function AdminPartidosPage() {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, kickoff_at, status, points_published,
      home_score_90, away_score_90,
      home_score_et, away_score_et,
      went_to_et, went_to_penalties,
      winner_country_id, mvp_player_id,
      home_country_id, away_country_id,
      home_country:countries!home_country_id (id, name, code),
      away_country:countries!away_country_id (id, name, code),
      phase:phases (name)
    `)
    .order('kickoff_at', { ascending: true })

  // Jugadores activos para el selector de MVP
  const { data: players } = await supabase
    .from('players')
    .select('id, name, country_id')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Agrupar partidos por fecha
  const byDate = new Map<string, typeof matches>()
  for (const m of matches ?? []) {
    const date = new Date(m.kickoff_at).toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(m)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-black text-white uppercase tracking-widest"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          Partidos
        </h1>
        <p className="text-gris-texto text-sm mt-1">
          Editá resultados, asigná MVP y controlá el estado de cada partido.
        </p>
      </div>

      {byDate.size === 0 ? (
        <div className="text-center py-16 bg-verde-medio border border-verde-borde rounded-lg">
          <p className="text-gris-texto">No hay partidos cargados todavía.</p>
        </div>
      ) : (
        Array.from(byDate.entries()).map(([date, dayMatches]) => (
          <section key={date} className="space-y-3">
            <h2
              className="text-xs font-black uppercase tracking-widest text-gris-texto capitalize"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              {date}
            </h2>
            <div className="space-y-2">
              {(dayMatches ?? []).map((m) => {
                const home = m.home_country as unknown as { id: number; name: string; code: string }
                const away = m.away_country as unknown as { id: number; name: string; code: string }
                const phase = m.phase as unknown as { name: string } | null

                return (
                  <div
                    key={m.id}
                    className="bg-verde-medio border border-verde-borde rounded-lg px-4 py-3"
                  >
                    {/* Cabecera */}
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-bold text-sm">
                            {home?.name} vs {away?.name}
                          </span>
                          <StatusBadge status={m.status} />
                          {m.points_published && (
                            <span className="text-xs text-green-400 font-bold border border-green-800/40 rounded px-1.5 py-0.5">
                              ✓ Publicado
                            </span>
                          )}
                        </div>
                        <div className="text-gris-texto text-xs mt-0.5 flex items-center gap-2">
                          <span>{new Date(m.kickoff_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>·</span>
                          <span>{phase?.name}</span>
                          {m.home_score_90 != null && (
                            <>
                              <span>·</span>
                              <span className="text-white font-bold">
                                {m.home_score_90} - {m.away_score_90}
                                {m.went_to_et && m.home_score_et != null && (
                                  <span className="text-gris-texto font-normal"> (TE: {m.home_score_et}-{m.away_score_et})</span>
                                )}
                                {m.went_to_penalties && <span className="text-gris-texto font-normal"> (pen)</span>}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Formulario de edición */}
                    <div className="mt-3">
                      <MatchEditForm
                        match={{
                          id: m.id,
                          status: m.status,
                          home_score_90: m.home_score_90,
                          away_score_90: m.away_score_90,
                          home_score_et: m.home_score_et,
                          away_score_et: m.away_score_et,
                          went_to_et: m.went_to_et ?? false,
                          went_to_penalties: m.went_to_penalties ?? false,
                          winner_country_id: m.winner_country_id,
                          mvp_player_id: m.mvp_player_id,
                          home_country_id: m.home_country_id!,
                          away_country_id: m.away_country_id!,
                          home_country: home,
                          away_country: away,
                        }}
                        players={players ?? []}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    scheduled: { label: 'Programado', color: 'text-gris-texto border-verde-borde' },
    live: { label: '🔴 En juego', color: 'text-green-400 border-green-800/40' },
    finished: { label: 'Finalizado', color: 'text-blue-400 border-blue-800/40' },
  }
  const s = map[status] ?? { label: status, color: 'text-white border-verde-borde' }
  return (
    <span className={`text-xs font-bold uppercase border rounded px-1.5 py-0.5 ${s.color}`}>
      {s.label}
    </span>
  )
}
