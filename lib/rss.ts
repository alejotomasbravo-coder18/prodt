/**
 * lib/rss.ts — Fetch, parse y caché de noticias RSS del Mundial 2026
 *
 * Estrategia de caché:
 *   - Lee MAX(fetched_at) de news_items
 *   - Si es < 30 min → devuelve los items del DB sin fetch externo
 *   - Si es ≥ 30 min (o no hay items) → llama RSS, parsea, upserta en DB
 *
 * Parsing manual de XML/RSS (sin dependencias externas):
 *   - Soporta CDATA en title/description
 *   - Extrae: title, link, description, pubDate, guid, source
 */

import { createServiceClient } from '@/lib/supabase/server'

// ── Tipos ─────────────────────────────────────────────────────

export interface NewsItem {
  id: number
  guid: string
  title: string
  link: string
  description: string | null
  source: string | null
  pub_date: string | null
  fetched_at: string
}

// ── Configuración ─────────────────────────────────────────────

const TTL_MINUTES = 30

// Fuentes RSS en orden de preferencia.
// Google News RSS en español/Argentina — no requiere auth ni API key.
const RSS_SOURCES = [
  {
    url: 'https://news.google.com/rss/search?q=mundial+futbol+2026&hl=es-419&gl=AR&ceid=AR:es',
    name: 'Google News',
  },
  {
    url: 'https://news.google.com/rss/search?q=FIFA+World+Cup+2026&hl=es&gl=US&ceid=US:es',
    name: 'Google News (EN)',
  },
]

// ── Parser XML sin dependencias ───────────────────────────────

interface RawRssItem {
  guid: string
  title: string
  link: string
  description: string | null
  pubDate: string | null
  sourceName: string | null
}

/** Extrae el texto de un tag XML, soportando CDATA y atributos. */
function extractTag(xml: string, tag: string): string | null {
  // CDATA: <tag><![CDATA[...]]></tag>
  const cdata = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i').exec(xml)
  if (cdata) return cdata[1].trim()

  // Normal: <tag>...</tag> o <tag attr="x">...</tag>
  const normal = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml)
  if (normal) return normal[1].trim()

  // Self-closing o vacío
  return null
}

/** Extrae el atributo isPermaLink o el texto de <guid>. */
function extractGuid(itemXml: string, link: string): string {
  return extractTag(itemXml, 'guid') ?? link
}

/** Limpia HTML básico de la descripción. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Parsea el XML del feed RSS y devuelve los items. */
function parseRssFeed(xml: string, defaultSource: string): RawRssItem[] {
  const items: RawRssItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1]

    const title = extractTag(content, 'title')
    const link  = extractTag(content, 'link') ?? extractTag(content, 'origLink') ?? ''

    if (!title || !link) continue

    const rawDesc = extractTag(content, 'description')
    const description = rawDesc ? stripHtml(rawDesc).slice(0, 300) : null

    // Google News incluye <source url="...">Nombre medio</source>
    const sourceName = extractTag(content, 'source') ?? defaultSource

    const pubDate = extractTag(content, 'pubDate')
    const guid    = extractGuid(content, link)

    items.push({ guid, title, link, description, pubDate, sourceName })
  }

  return items
}

// ── Fetch externo ─────────────────────────────────────────────

async function fetchRssFeed(
  url: string,
  sourceName: string
): Promise<RawRssItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ProDT/1.0 (Mundial 2026 news aggregator)' },
    next: { revalidate: 0 },  // no Next.js cache; usamos el propio
  })

  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`)
  }

  const xml = await res.text()
  return parseRssFeed(xml, sourceName)
}

// ── Función principal ─────────────────────────────────────────

/**
 * Devuelve noticias del Mundial 2026.
 * Si el caché en DB es fresco (< TTL_MINUTES) lo usa directo.
 * Si es viejo o no existe, refresca desde RSS y actualiza el DB.
 *
 * @param limit Número máximo de items a devolver (default 12)
 */
export async function fetchAndCacheNews(limit = 12): Promise<NewsItem[]> {
  const supa = createServiceClient()

  // ── Verificar TTL ────────────────────────────────────────
  const { data: latestRow } = await supa
    .from('news_items')
    .select('fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const isStale = !latestRow || (() => {
    const lastFetch = new Date(latestRow.fetched_at)
    const ageMs = Date.now() - lastFetch.getTime()
    return ageMs > TTL_MINUTES * 60 * 1000
  })()

  // ── Refrescar si es necesario ────────────────────────────
  if (isStale) {
    let items: RawRssItem[] = []

    // Intentar cada fuente en orden hasta obtener al menos un item
    for (const source of RSS_SOURCES) {
      try {
        const fetched = await fetchRssFeed(source.url, source.name)
        if (fetched.length > 0) {
          items = fetched
          break
        }
      } catch (err) {
        console.warn(`RSS fetch failed for ${source.name}:`, err)
      }
    }

    if (items.length > 0) {
      const now = new Date().toISOString()

      // Upsert: si el guid ya existe, actualiza title/desc/pub_date/fetched_at
      const toUpsert = items.slice(0, 50).map((item) => ({
        guid:        item.guid,
        title:       item.title,
        link:        item.link,
        description: item.description,
        source:      item.sourceName,
        pub_date:    item.pubDate ? new Date(item.pubDate).toISOString() : null,
        fetched_at:  now,
      }))

      const { error } = await supa
        .from('news_items')
        .upsert(toUpsert, { onConflict: 'guid', ignoreDuplicates: false })

      if (error) {
        console.error('news_items upsert error:', error)
      }
    }
  }

  // ── Leer del DB ──────────────────────────────────────────
  const { data: rows } = await supa
    .from('news_items')
    .select('id, guid, title, link, description, source, pub_date, fetched_at')
    .order('pub_date', { ascending: false, nullsFirst: false })
    .limit(limit)

  return (rows ?? []) as NewsItem[]
}
