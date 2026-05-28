'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (username.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres.')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('El usuario solo puede tener letras, números y guiones bajos.')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.toLowerCase(),
          display_name: displayName || username,
        },
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        setError('Ese email ya está registrado.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-verde-oscuro px-4 py-8">
      <div className="w-full max-w-md bg-verde-medio border border-verde-borde rounded-lg p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-black text-dorado tracking-widest uppercase"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            ProDT
          </h1>
          <p className="text-gris-texto text-sm mt-1 tracking-widest uppercase">
            Creá tu cuenta
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gris-texto mb-2">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={20}
                className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-4 py-3 text-sm focus:outline-none focus:border-dorado transition-colors"
                placeholder="pele10"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gris-texto mb-2">
                Nombre
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
                className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-4 py-3 text-sm focus:outline-none focus:border-dorado transition-colors"
                placeholder="Pelé"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gris-texto mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-4 py-3 text-sm focus:outline-none focus:border-dorado transition-colors"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gris-texto mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-4 py-3 text-sm focus:outline-none focus:border-dorado transition-colors"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gris-texto mb-2">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            className="w-full bg-dorado text-verde-oscuro font-black uppercase tracking-widest py-3 rounded hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-gris-texto text-sm mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-dorado font-bold hover:underline">
            Ingresá
          </Link>
        </p>

        {/* Sponsor Lazar */}
        <div className="mt-8 pt-6 border-t border-verde-borde text-center">
          <div className="inline-flex items-center gap-2 bg-azul-lazar px-4 py-2 rounded">
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
