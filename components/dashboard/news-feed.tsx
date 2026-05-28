import { fetchAndCacheNews } from '@/lib/rss'
import type { NewsItem } from '@/lib/rss'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const min  = Math.floor(diff / 60_000)
  const h    = Math.floor(min / 60)
  const d    = Math.floor(h / 24)
  if (d > 0)  return `hace ${d}d`
  if (h > 0)  return `hace ${h}h`
  if (min > 0) return `hace ${min}min`
  return 'ahora'
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-verde-medio border border-verde-borde rounded-lg p-4 hover:border-dorado/50 transition-all hover:bg-verde-medio/80"
    >
      {/* Fuente + tiempo */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className="text-dorado text-xs font-black uppercase tracking-widest truncate"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          {item.source ?? 'Noticias'}
        </span>
        <span className="text-gris-texto text-xs shrink-0">
          {timeAgo(item.pub_date)}
        </span>
      </div>

      {/* Título */}
      <h3 className="text-white text-sm font-bold leading-snug group-hover:text-dorado transition-colors line-clamp-2">
        {item.title}
      </h3>

      {/* Descripción */}
      {item.description && (
        <p className="text-gris-texto text-xs mt-1.5 leading-relaxed line-clamp-2">
          {item.description}
        </p>
      )}
    </a>
  )
}

export default async function NewsFeed() {
  let items: NewsItem[] = []
  let fetchError = false

  try {
    items = await fetchAndCacheNews(9)
  } catch (err) {
    console.error('NewsFeed error:', err)
    fetchError = true
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-xs font-black uppercase tracking-widest text-gris-texto"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          Noticias del Mundial
        </h2>
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded"
          style={{ background: '#0f2557', border: '1px solid #1a3b6e' }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-dorado animate-pulse"
          />
          <span
            className="text-dorado text-xs font-black uppercase tracking-widest"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '9px' }}
          >
            LAZAR LIVE
          </span>
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-950/40 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          No se pudieron cargar las noticias en este momento.
        </div>
      )}

      {!fetchError && items.length === 0 && (
        <div className="bg-verde-medio border border-verde-borde rounded-lg px-4 py-6 text-center text-gris-texto text-sm">
          No hay noticias cacheadas todavía. El cron las cargará en unos minutos.
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}
