import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-verde-oscuro text-white flex flex-col">

      {/* Navbar mínima para visitantes */}
      <header
        className="w-full px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '2px solid #c8a84b' }}
      >
        <span
          className="text-2xl font-black text-dorado tracking-widest uppercase"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          ProDT
        </span>

        <div className="flex items-center gap-3">
          {/* Badge Lazar */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded text-xs"
            style={{ background: '#0f2557' }}
          >
            <span className="text-dorado font-black uppercase tracking-widest">Lazar</span>
            <span className="text-dorado opacity-60">·</span>
            <span className="text-dorado opacity-80" style={{ fontSize: '10px' }}>
              Símbolo de Confianza
            </span>
          </div>

          <Link
            href="/login"
            className="text-white text-xs font-bold uppercase tracking-widest px-4 py-2 border border-verde-borde rounded hover:border-dorado transition-colors"
          >
            Ingresar
          </Link>
          <Link
            href="/register"
            className="bg-dorado text-verde-oscuro text-xs font-black uppercase tracking-widest px-4 py-2 rounded hover:brightness-110 transition-all"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Jugar gratis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
        <div className="max-w-3xl">
          {/* Mundial badge */}
          <div className="inline-flex items-center gap-2 bg-verde-medio border border-verde-borde px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest text-dorado mb-8">
            <span className="w-2 h-2 bg-dorado rounded-full animate-pulse" />
            Mundial 2026 · USA · México · Canadá
          </div>

          <h2
            className="text-5xl sm:text-6xl md:text-7xl font-black text-white uppercase leading-none mb-6"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            El juego del{' '}
            <span className="text-dorado">Mundial</span>
          </h2>

          <p className="text-gris-texto text-lg sm:text-xl max-w-xl mx-auto mb-10 leading-relaxed">
            Armá tu equipo en el <strong className="text-white">Gran DT</strong>, predecí los
            partidos en el <strong className="text-white">Prode</strong> y
            competí con tus amigos en ligas privadas.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-dorado text-verde-oscuro text-base font-black uppercase tracking-widest px-8 py-4 rounded hover:brightness-110 transition-all"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              Jugar gratis
            </Link>
            <Link
              href="/login"
              className="border border-dorado text-dorado text-base font-bold uppercase tracking-widest px-8 py-4 rounded hover:bg-dorado hover:text-verde-oscuro transition-all"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        <FeatureCard
          icon="⚽"
          title="Gran DT"
          description="Elegí 11 jugadores, armá tu formación y sumá puntos según el rendimiento real en cada partido."
        />
        <FeatureCard
          icon="🎯"
          title="Prode"
          description="Predecí el marcador exacto o el ganador de cada partido. Más difícil, más puntos."
        />
        <FeatureCard
          icon="🏆"
          title="Ligas privadas"
          description="Creá una liga con código de invitación y competí con tus amigos con premios propios."
        />
      </section>

      {/* Sponsor Lazar footer */}
      <footer
        className="w-full text-center py-6 border-t border-verde-borde"
        style={{ background: '#0d1f0f' }}
      >
        <div className="inline-flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded"
            style={{ background: '#0f2557' }}
          >
            <span className="text-dorado font-black uppercase tracking-widest text-sm">
              Lazar
            </span>
            <span className="text-dorado opacity-60 text-xs">·</span>
            <span className="text-dorado text-xs" style={{ letterSpacing: '0.05em' }}>
              Símbolo de Confianza
            </span>
          </div>
          <span className="text-gris-texto text-xs">
            ProDT · Mundial 2026
          </span>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="bg-verde-medio border border-verde-borde rounded-lg p-6 hover:border-dorado transition-colors">
      <div className="text-3xl mb-4">{icon}</div>
      <h3
        className="text-white font-black uppercase tracking-widest text-base mb-3"
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
      >
        {title}
      </h3>
      <p className="text-gris-texto text-sm leading-relaxed">{description}</p>
    </div>
  )
}
