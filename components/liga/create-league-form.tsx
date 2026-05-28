'use client'

import { useTransition, useState } from 'react'
import { createLeague } from '@/app/actions/liga'

interface Props {
  onSuccess?: (inviteCode: string) => void
}

export default function CreateLeagueForm({ onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createLeague(formData)
      if (result.error) {
        setError(result.error)
      } else if (result.success) {
        setSuccess(result.message ?? 'Liga creada.')
        const code = result.data?.inviteCode as string
        setInviteCode(code)
        onSuccess?.(code)
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre */}
      <div>
        <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
          Nombre de la liga *
        </label>
        <input
          name="name"
          type="text"
          required
          maxLength={50}
          placeholder="Los Cracks del Mundial"
          className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-dorado transition-colors placeholder:text-gris-texto"
        />
      </div>

      {/* Reglas */}
      <div>
        <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
          Reglas internas (opcional)
        </label>
        <textarea
          name="rules_text"
          rows={3}
          maxLength={500}
          placeholder="Ej: El ganador se lleva la cena del grupo..."
          className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-dorado transition-colors placeholder:text-gris-texto resize-none"
        />
      </div>

      {/* Premio */}
      <div>
        <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
          Premios (opcional)
        </label>
        <input
          name="prizes_text"
          type="text"
          maxLength={200}
          placeholder="Ej: El campeón no paga la próxima salida"
          className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-dorado transition-colors placeholder:text-gris-texto"
        />
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <div className="bg-verde-oscuro border border-dorado/40 rounded px-4 py-3 space-y-1">
          <p className="text-green-400 text-sm font-bold">{success}</p>
          {inviteCode && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-gris-texto text-xs">Código:</span>
              <span
                className="text-dorado text-xl font-black tracking-widest"
                style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
              >
                {inviteCode}
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(inviteCode)}
                className="text-gris-texto hover:text-white text-xs border border-verde-borde rounded px-2 py-0.5 transition-colors"
              >
                Copiar
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-dorado text-verde-oscuro font-black text-sm uppercase tracking-widest py-2.5 rounded transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
      >
        {isPending ? 'Creando...' : 'Crear Liga'}
      </button>
    </form>
  )
}
