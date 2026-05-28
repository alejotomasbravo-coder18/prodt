'use client'

import { useTransition, useState } from 'react'
import { joinLeague } from '@/app/actions/liga'

interface Props {
  onSuccess?: () => void
}

export default function JoinLeagueForm({ onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await joinLeague(formData)
      if (result.error) {
        setError(result.error)
      } else if (result.success) {
        setSuccess(result.message ?? 'Te uniste a la liga.')
        onSuccess?.()
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-gris-texto text-xs uppercase tracking-widest mb-1">
          Código de invitación
        </label>
        <input
          name="invite_code"
          type="text"
          required
          maxLength={6}
          placeholder="ABC123"
          autoComplete="off"
          className="w-full bg-verde-oscuro border border-verde-borde text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-dorado transition-colors placeholder:text-gris-texto uppercase tracking-widest font-bold"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '1.1rem' }}
          onChange={(e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
          }}
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-green-400 text-sm bg-verde-oscuro border border-green-800/40 rounded px-3 py-2 font-bold">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-dorado text-verde-oscuro font-black text-sm uppercase tracking-widest py-2.5 rounded transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
      >
        {isPending ? 'Uniéndose...' : 'Unirse a Liga'}
      </button>
    </form>
  )
}
