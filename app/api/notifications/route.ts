import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/notifications — trae las no vistas del usuario
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ notifications: [] })

  // Service client: la policy de SELECT requiere auth.uid() pero
  // las funciones de servidor no siempre propagan la cookie bien
  // → usamos service y filtramos por user_id explícitamente
  const supa = createServiceClient()
  const { data } = await supa
    .from('user_notifications')
    .select('id, type, message, metadata, created_at')
    .eq('user_id', user.id)
    .eq('seen', false)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ notifications: data ?? [] })
}

// POST /api/notifications — marca IDs como vistas
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await req.json()
  const ids: number[] = body.ids ?? []
  if (ids.length === 0) return NextResponse.json({ ok: true })

  const supa = createServiceClient()
  await supa
    .from('user_notifications')
    .update({ seen: true })
    .in('id', ids)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
