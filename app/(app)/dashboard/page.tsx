import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import NewsFeed from '@/components/dashboard/news-feed'
import CelebrationToasts from '@/components/dashboard/celebration-toasts'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', user!.id)
    .single()

  // Últimos partidos publicados con puntos del usuario
  const { data: recentScores } = await supabase
    .from('user_match_scores')
    .select(`
      total_points,
      gran_dt_points,
      captain_bonus,
      prode_points,
      match:matches (
        kickoff_at,
        home_score_90,
        away_score_90,
        home_country:countries!home_country_id (name, code),
        away_country:countries!away_country_id (name, code)
      )
    `)
    .eq('user_id', user!.id)
    .order('calculated_at', { ascending: false })
    .limit(5)

  // Puntos totales
  const { data: totalRow } = await supabase
    .from('user_match_scores')
    .select('total_points')
    .eq('user_id', user!.id)

  const totalPoints = totalRow?.reduce((acc, row) => acc + (row.total_points ?? 0), 0) ?? 0

  // Posición en ranking global
  const { data: rankRow } = await supabase
    .from('global_ranking')
    .select('rank')
    .eq('user_id', user!.id)
    .single()

  const name = profile?.display_name || profile?.username || 'Jugador'

  return (
    <div className="space-y-8">
      {/* Toasts de celebración (client component, no bloquea render) */}
      <CelebrationToasts />

      {/* Bienvenida */}
      <div>
        <h1
          className="text-3xl font-black text-white uppercase tracking-widest"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          Hola, {name}
        </h1>
        <p className="text-gris-texto mt-1">
          Mundial 2026 · Gran DT y Prode
        </p>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Puntos totales"
          value={totalPoints.toString()}
          accent
        />
        <MetricCard
          label="Posición global"
          value={rankRow?.rank ? `#${rankRow.rank}` : '—'}
        />
        <MetricCard
          label="Próximo partido"
          value="Ver Prode →"
          href="/prode"
        />
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickLink
          href="/gran-dt"
          icon="⚽"
          title="Gran DT"
          description="Armá tu equipo"
        />
        <QuickLink
          href="/prode"
          icon="🎯"
          title="Prode"
          description="Predecí los partidos"
        />
        <QuickLink
          href="/ranking"
          icon="📊"
          title="Ranking"
          description="Tabla general"
        />
        <QuickLink
          href="/liga"
          icon="🏆"
          title="Mi Liga"
          description="Liga privada"
        />
      </div>

      {/* Últimos resultados */}
      {recentScores && recentScores.length > 0 && (
        <div>
          <h2
            className="text-sm font-black uppercase tracking-widest text-gris-texto mb-4"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Últimos partidos
          </h2>
          <div className="space-y-2">
            {recentScores.map((score, idx) => {
              const match = score.match as any
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-verde-medio border border-verde-borde rounded-lg px-5 py-4"
                >
                  <div className="text-sm text-white">
                    <span className="font-bold">
                      {match?.home_country?.name} {match?.home_score_90} -{' '}
                      {match?.away_score_90} {match?.away_country?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="text-xs text-gris-texto">
                      <div>Gran DT: +{(score.gran_dt_points ?? 0) + (score.captain_bonus ?? 0)}</div>
                      <div>Prode: +{score.prode_points ?? 0}</div>
                    </div>
                    <div
                      className="text-xl font-black text-dorado"
                      style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                    >
                      +{score.total_points}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Feed de noticias del Mundial */}
      <NewsFeed />

      {/* Estado vacío */}
      {(!recentScores || recentScores.length === 0) && (
        <div className="text-center py-16 bg-verde-medio border border-verde-borde rounded-lg">
          <p className="text-4xl mb-4">⚽</p>
          <p
            className="text-white font-black uppercase tracking-widest text-lg mb-2"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            El torneo está por empezar
          </p>
          <p className="text-gris-texto text-sm mb-6">
            Armá tu equipo en Gran DT y predecí los partidos en el Prode
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/gran-dt"
              className="bg-dorado text-verde-oscuro text-xs font-black uppercase tracking-widest px-6 py-3 rounded hover:brightness-110 transition-all"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              Armar equipo
            </Link>
            <Link
              href="/prode"
              className="border border-dorado text-dorado text-xs font-bold uppercase tracking-widest px-6 py-3 rounded hover:bg-dorado hover:text-verde-oscuro transition-all"
            >
              Ver partidos
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componentes locales ────────────────────────────────────

function MetricCard({
  label,
  value,
  accent,
  href,
}: {
  label: string
  value: string
  accent?: boolean
  href?: string
}) {
  const content = (
    <div
      className={`
        bg-verde-medio border rounded-lg px-6 py-5 flex flex-col gap-1
        ${accent ? 'border-dorado' : 'border-verde-borde'}
        ${href ? 'hover:border-dorado transition-colors cursor-pointer' : ''}
      `}
    >
      <span className="text-xs font-bold uppercase tracking-widest text-gris-texto">
        {label}
      </span>
      <span
        className={`text-3xl font-black ${accent ? 'text-dorado' : 'text-white'}`}
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
      >
        {value}
      </span>
    </div>
  )

  if (href) return <Link href={href}>{content}</Link>
  return content
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="bg-verde-medio border border-verde-borde rounded-lg p-5 flex items-center gap-4 hover:border-dorado transition-colors group"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <div
          className="text-white font-black uppercase tracking-widest text-sm group-hover:text-dorado transition-colors"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          {title}
        </div>
        <div className="text-gris-texto text-xs mt-0.5">{description}</div>
      </div>
    </Link>
  )
}
