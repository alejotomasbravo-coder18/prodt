'use client'

import { useTransition, useState } from 'react'
import { publishPoints } from '@/app/actions/admin'

interface PublishButtonProps {
  matchId: number
  matchLabel: string
}

export default function PublishButton({ matchId, matchLabel }: PublishButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handlePublish() {
    if (
      !confirm(
        `¿Publicar puntos de "${matchLabel}"?\n\nEsto calculará Gran DT, Prode y el ganador de fecha en todas las ligas. Esta acción no se puede deshacer.`
      )
    )
      return

    setError(null)
    setSuccess(null)

    startTransition(async () => {
      const result = await publishPoints(matchId)
      if (result.error) setError(result.error)
      else setSuccess(result.message ?? 'Puntos publicados.')
    })
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-red-400 text-xs bg-red-950/30 border border-red-800 rounded px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-green-400 text-xs bg-verde-oscuro border border-green-800/30 rounded px-3 py-2 font-bold">
          ✓ {success}
        </p>
      )}
      <button
        onClick={handlePublish}
        disabled={isPending}
        className="w-full bg-dorado text-verde-oscuro font-black text-sm uppercase tracking-widest py-3 rounded transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
      >
        {isPending ? 'Calculando y publicando...' : '🏆 Publicar puntos'}
      </button>
    </div>
  )
}
