'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-verde-oscuro px-4">
      {/* Card */}
      <div className="w-full max-w-md bg-verde-medio border border-verde-borde rounded-lg p-8">
        {/* Logo / título */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-black text-dorado tracking-widest uppercase"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            ProDT
          </h1>
          <p className="text-gris-texto text-sm mt-1 tracking-widest uppercase">
            Gran DT y Prode · Mundial 2026
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-bold uppercase tracking-widest text-gris-texto mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-4 py-3 text-sm focus:outline-none focus:border-dorado transition-colors"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold uppercase tracking-widest text-gris-texto mb-2"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-4 py-3 text-sm focus:outline-none focus:border-dorado transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dorado text-verde-oscuro font-black uppercase tracking-widest py-3 rounded hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-gris-texto text-sm mt-6">
          ¿No tenés cuenta?{' '}
          <Link
            href="/register"
            className="text-dorado font-bold hover:underline"
          >
            Registrate
          </Link>
        </p>

        {/* Sponsor Lazar */}
        <div className="mt-8 pt-6 border-t border-verde-borde text-center">
          <div
            className="inline-flex items-center gap-2 bg-azul-lazar px-4 py-2 rounded"
          >
            <span className="text-dorado text-xs font-black uppercase tracking-widest">
              Lazar
            </span>
            <span className="text-gris-texto text-xs">·</span>
            <span className="text-dorado text-xs tracking-wide">
              Símbolo de Confianza
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
