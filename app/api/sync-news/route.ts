/**
 * GET /api/sync-news
 *
 * Refresca el caché de noticias RSS del Mundial 2026.
 * Llamado por Vercel Cron Jobs cada 30 minutos.
 * También puede invocarse manualmente desde el dashboard.
 *
 * Autenticación: header Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchAndCacheNews } from '@/lib/rss'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const items = await fetchAndCacheNews(50)
    return NextResponse.json({
      ok: true,
      count: items.length,
      fetched_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('sync-news error:', err)
    return NextResponse.json(
      { error: 'Error al sincronizar noticias', detail: String(err) },
      { status: 500 }
    )
  }
}
