import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, username')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-verde-oscuro">
      {/* Admin nav */}
      <header
        className="w-full px-6 py-3 flex items-center gap-6"
        style={{ background: '#1a0000', borderBottom: '2px solid #ef4444' }}
      >
        <span
          className="text-white font-black uppercase tracking-widest text-sm"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          ProDT Admin
        </span>
        <nav className="flex gap-4">
          {[
            { href: '/admin/partidos', label: 'Partidos' },
            { href: '/admin/eventos',  label: 'Eventos' },
            { href: '/admin/publicar', label: 'Publicar' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-xs font-bold uppercase tracking-widest text-red-300 hover:text-white transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-gris-texto text-xs">{profile.username}</span>
          <Link
            href="/dashboard"
            className="text-xs font-bold uppercase tracking-widest text-gris-texto hover:text-white transition-colors"
          >
            ← App
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
