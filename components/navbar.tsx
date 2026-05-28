'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/gran-dt',   label: 'Gran DT' },
  { href: '/prode',     label: 'Prode' },
  { href: '/jugadores', label: 'Jugadores' },
  { href: '/ranking',   label: 'Ranking' },
  { href: '/liga',      label: 'Mi Liga' },
  { href: '/perfil',    label: 'Perfil' },
]

interface NavbarProps {
  username?: string
  isAdmin?: boolean
}

export default function Navbar({ username, isAdmin }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav
      className="sticky top-0 z-50 w-full"
      style={{
        background: '#0d1f0f',
        borderBottom: '2px solid #c8a84b',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-3 shrink-0"
          >
            <span
              className="text-2xl font-black text-dorado tracking-widest uppercase"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              ProDT
            </span>
          </Link>

          {/* Links — desktop */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors
                    ${active
                      ? 'text-dorado'
                      : 'text-white hover:text-dorado'
                    }
                  `}
                  style={{ letterSpacing: '0.12em' }}
                >
                  {link.label}
                </Link>
              )
            })}
            {isAdmin && (
              <Link
                href="/admin/partidos"
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
                style={{ letterSpacing: '0.12em' }}
              >
                Admin
              </Link>
            )}
          </div>

          {/* Derecha — Sponsor + usuario */}
          <div className="hidden md:flex items-center gap-4">
            {/* Badge Lazar */}
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-black uppercase tracking-widest"
              style={{ background: '#0f2557' }}
            >
              <span className="text-dorado">Lazar</span>
              <span className="text-dorado opacity-50">·</span>
              <span className="text-dorado opacity-80 font-normal tracking-wide normal-case" style={{ fontSize: '10px' }}>
                Símbolo de Confianza
              </span>
            </div>

            {/* Usuario + logout */}
            {username && (
              <div className="flex items-center gap-3">
                <span className="text-gris-texto text-xs uppercase tracking-widest">
                  {username}
                </span>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="bg-dorado text-verde-oscuro text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded hover:brightness-110 transition-all disabled:opacity-50"
                  style={{ fontFamily: 'Arial Black, Arial, sans-serif', letterSpacing: '0.1em' }}
                >
                  {loggingOut ? '...' : 'Salir'}
                </button>
              </div>
            )}
          </div>

          {/* Menú hamburguesa — mobile */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Menú mobile */}
      {menuOpen && (
        <div
          className="md:hidden border-t border-verde-borde"
          style={{ background: '#112213' }}
        >
          {NAV_LINKS.map((link) => {
            const active = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`
                  block px-6 py-3 text-xs font-bold uppercase tracking-widest border-b border-verde-borde
                  ${active ? 'text-dorado' : 'text-white'}
                `}
              >
                {link.label}
              </Link>
            )
          })}
          {isAdmin && (
            <Link
              href="/admin/partidos"
              onClick={() => setMenuOpen(false)}
              className="block px-6 py-3 text-xs font-bold uppercase tracking-widest text-red-400 border-b border-verde-borde"
            >
              Admin
            </Link>
          )}
          <div className="px-6 py-4 flex items-center justify-between">
            <span className="text-gris-texto text-xs">{username}</span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-dorado text-verde-oscuro text-xs font-black uppercase tracking-widest px-4 py-2 rounded"
            >
              Salir
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
