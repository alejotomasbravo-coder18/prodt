import { createClient, createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

// ── Helpers ────────────────────────────────────────────────

/** Color determinístico basado en el username */
function avatarColor(username: string): string {
  const COLORS = [
    '#c8a84b', // dorado
    '#4ade80', // verde
    '#60a5fa', // azul
    '#f87171', // rojo
    '#c084fc', // violeta
    '#fb923c', // naranja
    '#34d399', // esmeralda
    '#a78bfa', // índigo
  ]
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

// ── Page ──────────────────────────────────────────────────

export default async function PerfilPage() {
  const supabase = await createClient()
  const supa = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()

  // ── Perfil ────────────────────────────────────────────
  const { data: profile } = await supa
    .from('profiles')
    .select('username, display_name, is_global_champion, created_at')
    .eq('id', user!.id)
    .single()

  const displayName = profile?.display_name || profile?.username || 'Jugador'
  const username    = profile?.username ?? ''
  const color       = avatarColor(username)
  const avatar      = initials(displayName)

  // ── Stats del torneo ──────────────────────────────────
  const { data: scores } = await supabase
    .from('user_match_scores')
    .select('total_points, gran_dt_points, captain_bonus, prode_points, calculated_at')
    .eq('user_id', user!.id)
    .order('total_points', { ascending: false })

  const totalPoints     = scores?.reduce((acc, s) => acc + (s.total_points ?? 0), 0) ?? 0
  const totalGranDT     = scores?.reduce((acc, s) => acc + (s.gran_dt_points ?? 0) + (s.captain_bonus ?? 0), 0) ?? 0
  const totalProde      = scores?.reduce((acc, s) => acc + (s.prode_points ?? 0), 0) ?? 0
  const partidas        = scores?.length ?? 0
  const mejorFecha      = scores?.[0]?.total_points ?? 0

  // ── Exactos en el prode ───────────────────────────────
  const { count: exactos } = await supabase
    .from('prode_predictions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .gt('points_earned', 0)

  // ── Balance de cambios ────────────────────────────────
  const { data: balance } = await supabase
    .from('user_transfer_balance')
    .select('available, total_used')
    .eq('user_id', user!.id)
    .single()

  // ── Ranking global ────────────────────────────────────
  const { data: rankRow } = await supabase
    .from('global_ranking')
    .select('rank, total_points')
    .eq('user_id', user!.id)
    .maybeSingle()

  // ── Ligas y campeonatos ───────────────────────────────
  const { data: memberships } = await supa
    .from('league_members')
    .select('role, is_league_champion, league:leagues(name)')
    .eq('user_id', user!.id)

  type MembershipRow = { role: string; is_league_champion: boolean; league: unknown }
  const typedMemberships = (memberships ?? []) as unknown as MembershipRow[]
  const leagueChampionships = typedMemberships.filter((m) => m.is_league_champion)

  // ── Logros ────────────────────────────────────────────
  type Logro = { icon: string; title: string; desc: string; unlocked: boolean }
  const logros: Logro[] = [
    {
      icon: '👑',
      title: 'Gran Campeón',
      desc: 'Terminaste #1 en el ranking global del Mundial 2026.',
      unlocked: !!profile?.is_global_champion,
    },
    ...leagueChampionships.map((m) => ({
      icon: '🥇',
      title: `Campeón de liga`,
      desc: `Ganaste la liga "${(m.league as unknown as { name: string })?.name ?? ''}"`,
      unlocked: true,
    })),
    {
      icon: '🎯',
      title: 'Francotirador',
      desc: 'Acertaste al menos 5 marcadores exactos en el Prode.',
      unlocked: (exactos ?? 0) >= 5,
    },
    {
      icon: '⚽',
      title: 'Goleador de puntos',
      desc: 'Superaste los 100 puntos totales.',
      unlocked: totalPoints >= 100,
    },
    {
      icon: '🔄',
      title: 'Director técnico',
      desc: 'Usaste al menos 3 cambios en Gran DT.',
      unlocked: (balance?.total_used ?? 0) >= 3,
    },
    {
      icon: '📈',
      title: 'En racha',
      desc: 'Tuviste una fecha con 15+ puntos.',
      unlocked: mejorFecha >= 15,
    },
  ]

  const unlockedLogros  = logros.filter((l) => l.unlocked)
  const lockedLogros    = logros.filter((l) => !l.unlocked)

  return (
    <div className="space-y-8 max-w-2xl">
      {/* ── Header / Avatar ── */}
      <div className="flex items-center gap-5">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 text-2xl font-black"
          style={{
            background: color,
            color: '#0d1f0f',
            fontFamily: 'Arial Black, Arial, sans-serif',
          }}
        >
          {avatar}
        </div>
        <div>
          <h1
            className="text-2xl font-black text-white uppercase tracking-widest leading-tight"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            {displayName}
          </h1>
          <p className="text-gris-texto text-sm mt-0.5">@{username}</p>
          {profile?.is_global_champion && (
            <span
              className="inline-block mt-2 text-xs font-black px-2 py-1 rounded animate-pulse"
              style={{ background: '#c8a84b', color: '#0d1f0f', fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              👑 GRAN CAMPEÓN MUNDIAL 2026
            </span>
          )}
        </div>
      </div>

      {/* ── Stats principales ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Puntos totales', value: totalPoints, accent: true },
          { label: 'Posición global', value: rankRow?.rank ? `#${rankRow.rank}` : '—' },
          { label: 'Partidas jugadas', value: partidas },
          { label: 'Mejor fecha', value: mejorFecha ? `+${mejorFecha}` : '—' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-verde-medio border rounded-lg px-4 py-4 flex flex-col gap-1"
            style={{ borderColor: s.accent ? '#c8a84b' : '#1a3b1e' }}
          >
            <span className="text-gris-texto text-xs uppercase tracking-widest">{s.label}</span>
            <span
              className={`text-2xl font-black ${s.accent ? 'text-dorado' : 'text-white'}`}
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Desglose de puntos ── */}
      <div className="bg-verde-medio border border-verde-borde rounded-lg p-5 space-y-3">
        <h2
          className="text-xs font-black uppercase tracking-widest text-gris-texto"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          Desglose
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Gran DT', value: totalGranDT, color: '#4ade80' },
            { label: 'Prode', value: totalProde, color: '#60a5fa' },
            { label: 'Exactos en Prode', value: exactos ?? 0, color: '#c084fc' },
            { label: 'Cambios usados', value: balance?.total_used ?? 0, color: '#fb923c' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div
                className="text-xl font-black tabular-nums"
                style={{ color: s.color, fontFamily: 'Arial Black, Arial, sans-serif' }}
              >
                {s.value}
              </div>
              <div className="text-gris-texto text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Barra de cambios disponibles */}
        <div className="pt-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gris-texto text-xs">Cambios disponibles en Gran DT</span>
            <span className="text-white text-xs font-bold">
              {balance?.available ?? 0} / 11
            </span>
          </div>
          <div className="h-2 bg-verde-borde rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-dorado transition-all"
              style={{ width: `${((balance?.available ?? 0) / 11) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Ligas ── */}
      {typedMemberships.length > 0 && (
        <div className="bg-verde-medio border border-verde-borde rounded-lg p-5 space-y-3">
          <h2
            className="text-xs font-black uppercase tracking-widest text-gris-texto"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Mis ligas ({typedMemberships.length})
          </h2>
          <div className="space-y-2">
            {typedMemberships.map((m, idx) => {
              const league = m.league as { name: string }
              return (
                <div key={idx} className="flex items-center gap-2">
                  {m.is_league_champion && <span className="text-base">🥇</span>}
                  <span className="text-white text-sm">{league?.name}</span>
                  {m.role === 'admin' && (
                    <span className="text-xs bg-azul-lazar text-dorado px-1.5 py-0.5 rounded font-bold uppercase">
                      Admin
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <Link href="/liga" className="text-dorado text-xs hover:text-white transition-colors">
            Gestionar ligas →
          </Link>
        </div>
      )}

      {/* ── Logros desbloqueados ── */}
      {unlockedLogros.length > 0 && (
        <div className="space-y-3">
          <h2
            className="text-xs font-black uppercase tracking-widest text-gris-texto"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Logros desbloqueados ({unlockedLogros.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unlockedLogros.map((l) => (
              <div
                key={l.title}
                className="flex items-start gap-3 bg-verde-medio border border-dorado/40 rounded-lg px-4 py-3"
              >
                <span className="text-2xl shrink-0">{l.icon}</span>
                <div>
                  <div
                    className="text-dorado text-sm font-black"
                    style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                  >
                    {l.title}
                  </div>
                  <div className="text-gris-texto text-xs mt-0.5">{l.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Logros bloqueados ── */}
      {lockedLogros.length > 0 && (
        <div className="space-y-3">
          <h2
            className="text-xs font-black uppercase tracking-widest text-gris-texto"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Por desbloquear ({lockedLogros.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lockedLogros.map((l) => (
              <div
                key={l.title}
                className="flex items-start gap-3 bg-verde-medio border border-verde-borde rounded-lg px-4 py-3 opacity-40"
              >
                <span className="text-2xl shrink-0 grayscale">{l.icon}</span>
                <div>
                  <div
                    className="text-white text-sm font-black"
                    style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                  >
                    {l.title}
                  </div>
                  <div className="text-gris-texto text-xs mt-0.5">{l.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Links útiles ── */}
      <div className="flex gap-3 flex-wrap">
        <Link
          href="/ranking"
          className="text-xs text-gris-texto border border-verde-borde rounded px-4 py-2 hover:text-white hover:border-white transition-colors"
        >
          Ver ranking global
        </Link>
        <Link
          href="/gran-dt"
          className="text-xs text-gris-texto border border-verde-borde rounded px-4 py-2 hover:text-white hover:border-white transition-colors"
        >
          Mi equipo Gran DT
        </Link>
      </div>
    </div>
  )
}
