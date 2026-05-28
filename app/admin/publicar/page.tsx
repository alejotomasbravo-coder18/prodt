import { createClient } from '@/lib/supabase/server'
import PublishButton from '@/components/admin/publish-button'
import ChampionButton from '@/components/admin/champion-button'

export default async function AdminPublicarPage() {
  const supabase = await createClient()

  // Partidos finalizados que aún no publicaron puntos
  const { data: pendingMatches } = await supabase
    .from('matches')
    .select(`
      id, kickoff_at, status, points_published,
      mvp_player_id,
      home_country:countries!home_country_id (name, code),
      away_country:countries!away_country_id (name, code),
      phase:phases (name)
    `)
    .eq('status', 'finished')
    .order('kickoff_at', { ascending: false })

  const unpublished = (pendingMatches ?? []).filter((m) => !m.points_published)
  const published = (pendingMatches ?? []).filter((m) => m.points_published)

  // Stats globales
  const { count: userCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  const { count: teamCount } = await supabase
    .from('user_teams')
    .select('id', { count: 'exact', head: true })

  const { count: publishedMatchCount } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('points_published', true)

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-2xl font-black text-white uppercase tracking-widest"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          Publicar puntos
        </h1>
        <p className="text-gris-texto text-sm mt-1">
          Al publicar se calculan los puntos de Gran DT, se evalúan las predicciones del Prode
          y se asignan cambios extra a los ganadores de fecha en cada liga.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Usuarios', value: userCount ?? 0 },
          { label: 'Equipos armados', value: teamCount ?? 0 },
          { label: 'Partidos publicados', value: publishedMatchCount ?? published.length },
        ].map((s) => (
          <div key={s.label} className="bg-verde-medio border border-verde-borde rounded-lg px-4 py-3 text-center">
            <div className="text-gris-texto text-xs uppercase tracking-widest">{s.label}</div>
            <div
              className="text-dorado text-2xl font-black mt-1"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Partidos pendientes de publicar */}
      {unpublished.length > 0 ? (
        <section className="space-y-3">
          <h2
            className="text-xs font-black uppercase tracking-widest text-red-400"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Pendientes de publicar ({unpublished.length})
          </h2>
          <div className="space-y-3">
            {unpublished.map((m) => {
              const home = m.home_country as { name: string; code: string }
              const away = m.away_country as { name: string; code: string }
              const phase = m.phase as { name: string } | null
              const matchLabel = `${home?.name} vs ${away?.name}`

              return (
                <div
                  key={m.id}
                  className="bg-verde-medio border border-red-900/40 rounded-lg p-5 space-y-3"
                >
                  <div>
                    <p className="text-white font-bold">{matchLabel}</p>
                    <p className="text-gris-texto text-xs mt-0.5">
                      {new Date(m.kickoff_at).toLocaleString('es-AR')} · {phase?.name}
                    </p>
                    {!m.mvp_player_id && (
                      <p className="text-yellow-500 text-xs mt-1">
                        ⚠ Sin MVP asignado. El MVP aporta +5 pts al jugador. Podés asignarlo en{' '}
                        <a href="/admin/partidos" className="underline hover:text-yellow-400">
                          /admin/partidos
                        </a>
                        .
                      </p>
                    )}
                  </div>
                  <PublishButton matchId={m.id} matchLabel={matchLabel} />
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <div className="bg-verde-medio border border-verde-borde rounded-lg px-5 py-8 text-center">
          <p className="text-green-400 font-bold text-sm">✓ Todos los partidos finalizados tienen puntos publicados.</p>
          <p className="text-gris-texto text-xs mt-1">
            Cuando finalice un nuevo partido aparecerá acá.
          </p>
        </div>
      )}

      {/* Partidos ya publicados */}
      {published.length > 0 && (
        <section className="space-y-3">
          <h2
            className="text-xs font-black uppercase tracking-widest text-gris-texto"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Ya publicados ({published.length})
          </h2>
          <div className="bg-verde-medio border border-verde-borde rounded-lg overflow-hidden">
            {published.map((m, idx) => {
              const home = m.home_country as { name: string; code: string }
              const away = m.away_country as { name: string; code: string }
              return (
                <div
                  key={m.id}
                  className={`flex items-center justify-between px-4 py-3 text-sm ${
                    idx < published.length - 1 ? 'border-b border-verde-borde' : ''
                  }`}
                >
                  <span className="text-white">
                    {home?.name} vs {away?.name}
                  </span>
                  <span className="text-green-400 text-xs font-bold">✓ Publicado</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Gran Campeón — fin del torneo */}
      <div className="border border-dorado/40 rounded-lg p-5 space-y-3" style={{ background: '#0f1a0a' }}>
        <div>
          <p
            className="text-dorado text-xs font-black uppercase tracking-widest"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            🏆 Fin del torneo
          </p>
          <p className="text-gris-texto text-xs mt-1">
            Usá este botón solo cuando termine el último partido del torneo. Asigna el trofeo de
            Gran Campeón al #1 del ranking global y el de Campeón de Liga al #1 de cada liga privada.
            Esta acción no se puede deshacer.
          </p>
        </div>
        <ChampionButton />
      </div>

      {/* Flujo recordatorio */}
      <div className="bg-azul-lazar/20 border border-azul-lazar/40 rounded-lg p-5 space-y-2">
        <p
          className="text-dorado text-xs font-black uppercase tracking-widest"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          Flujo recomendado post-partido
        </p>
        <ol className="text-gris-texto text-xs space-y-1 list-decimal list-inside">
          <li>En <strong className="text-white">Partidos</strong>: actualizar el resultado (90&apos;, T. extra si aplica, ganador)</li>
          <li>En <strong className="text-white">Partidos</strong>: asignar el MVP</li>
          <li>En <strong className="text-white">Eventos</strong>: cargar goles, asistencias y tarjetas</li>
          <li>En esta pantalla: presionar <strong className="text-white">Publicar puntos</strong></li>
        </ol>
      </div>
    </div>
  )
}
