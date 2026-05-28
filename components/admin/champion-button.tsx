'use client'

import { useTransition, useState } from 'react'
import { markTournamentEnd } from '@/app/actions/admin'

export default function ChampionButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true)
      return
    }
    startTransition(async () => {
      const res = await markTournamentEnd()
      setResult(res)
      setConfirmed(false)
    })
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`w-full text-xs font-black uppercase tracking-widest px-4 py-3 rounded transition-all disabled:opacity-50 ${
          confirmed
            ? 'bg-yellow-500 text-black animate-pulse'
            : 'bg-dorado/20 border border-dorado text-dorado hover:bg-dorado hover:text-verde-oscuro'
        }`}
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
      >
        {isPending
          ? 'Asignando...'
          : confirmed
          ? '⚠ Confirmar — esto es irreversible'
          : '🏆 Marcar fin del torneo y asignar Gran Campeón'}
      </button>

      {confirmed && (
        <p className="text-yellow-400 text-xs text-center">
          Hacé clic de nuevo para confirmar. Se asignará el trofeo al #1 global y al #1 de cada liga.
        </p>
      )}

      {result?.error && (
        <p className="text-red-400 text-xs bg-red-950/40 border border-red-800 rounded px-3 py-2">
          {result.error}
        </p>
      )}
      {result?.message && !result.error && (
        <p className="text-green-400 text-xs bg-green-950/40 border border-green-700 rounded px-3 py-2">
          ✓ {result.message}
        </p>
      )}
    </div>
  )
}
