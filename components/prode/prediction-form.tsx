'use client'

import { useState, useTransition } from 'react'
import { submitPrediction } from '@/app/actions/prode'
import type { Country, ProdePrediction, PredMethod } from '@/lib/types'

interface PredictionFormProps {
  matchId: number
  phaseOrder: number
  homeCountry: Country
  awayCountry: Country
  existing: ProdePrediction | null
  deadlinePassed: boolean
}

export default function PredictionForm({
  matchId,
  phaseOrder,
  homeCountry,
  awayCountry,
  existing,
  deadlinePassed,
}: PredictionFormProps) {
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Estado para fase de grupos ────────────────────────────
  const [homeScore, setHomeScore] = useState<string>(
    existing?.pred_home_score != null ? String(existing.pred_home_score) : ''
  )
  const [awayScore, setAwayScore] = useState<string>(
    existing?.pred_away_score != null ? String(existing.pred_away_score) : ''
  )

  // ── Estado para eliminatorias ─────────────────────────────
  const [winnerId, setWinnerId] = useState<number | null>(
    existing?.pred_winner_id ?? null
  )
  const [method, setMethod] = useState<PredMethod>(
    existing?.pred_method ?? '90min'
  )
  const [kHomeScore, setKHomeScore] = useState<string>(
    existing?.pred_score_method_home != null
      ? String(existing.pred_score_method_home)
      : ''
  )
  const [kAwayScore, setKAwayScore] = useState<string>(
    existing?.pred_score_method_away != null
      ? String(existing.pred_score_method_away)
      : ''
  )

  const isGroup = phaseOrder === 1

  // ── Validaciones locales ──────────────────────────────────
  function isGroupValid(): boolean {
    return homeScore !== '' && awayScore !== '' &&
      parseInt(homeScore) >= 0 && parseInt(awayScore) >= 0
  }

  function isKnockoutValid(): boolean {
    return winnerId !== null
  }

  function canSubmit(): boolean {
    return isGroup ? isGroupValid() : isKnockoutValid()
  }

  // ── Submit ────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      let result

      if (isGroup) {
        result = await submitPrediction({
          type: 'group',
          matchId,
          homeScore: parseInt(homeScore),
          awayScore: parseInt(awayScore),
        })
      } else {
        result = await submitPrediction({
          type: 'knockout',
          matchId,
          winnerId: winnerId!,
          method,
          homeScore: kHomeScore !== '' ? parseInt(kHomeScore) : null,
          awayScore: kAwayScore !== '' ? parseInt(kAwayScore) : null,
        })
      }

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  // ── Si el deadline pasó: solo mostrar la predicción ───────
  if (deadlinePassed) {
    if (!existing) {
      return (
        <p className="text-gris-texto text-xs text-center py-3">
          No predijiste este partido.
        </p>
      )
    }
    // Se renderiza desde el padre (match-card) el resultado
    return null
  }

  // ── Formulario activo ─────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-verde-borde">
      {isGroup ? (
        /* ── Fase de grupos: marcador ─────────────────────── */
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-gris-texto text-xs uppercase tracking-widest">
              {homeCountry.name}
            </span>
            <input
              type="number"
              min={0}
              max={20}
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              placeholder="0"
              className="w-16 text-center text-2xl font-black text-white bg-verde-oscuro border border-verde-borde rounded-lg px-2 py-3 focus:outline-none focus:border-dorado transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            />
          </div>

          <span className="text-dorado font-black text-xl mt-4">–</span>

          <div className="flex flex-col items-center gap-1">
            <span className="text-gris-texto text-xs uppercase tracking-widest">
              {awayCountry.name}
            </span>
            <input
              type="number"
              min={0}
              max={20}
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              placeholder="0"
              className="w-16 text-center text-2xl font-black text-white bg-verde-oscuro border border-verde-borde rounded-lg px-2 py-3 focus:outline-none focus:border-dorado transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            />
          </div>
        </div>
      ) : (
        /* ── Eliminatorias ────────────────────────────────── */
        <div className="space-y-4">
          {/* Ganador */}
          <div>
            <p className="text-gris-texto text-xs uppercase tracking-widest mb-2 text-center">
              Ganador
            </p>
            <div className="flex gap-3 justify-center">
              {[homeCountry, awayCountry].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setWinnerId(c.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold transition-all
                    ${winnerId === c.id
                      ? 'border-dorado bg-dorado/10 text-dorado'
                      : 'border-verde-borde text-white hover:border-dorado/50'
                    }
                  `}
                >
                  {c.flag_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={c.flag_url} alt={c.name} className="w-5 h-auto" />
                  )}
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Método */}
          {winnerId && (
            <div>
              <p className="text-gris-texto text-xs uppercase tracking-widest mb-2 text-center">
                ¿Cuándo se define?
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                {(
                  [
                    { value: '90min',      label: '90 min' },
                    { value: 'extra_time', label: 'Tiempo extra' },
                    { value: 'penalties',  label: 'Penales' },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMethod(value)}
                    className={`
                      px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest border transition-all
                      ${method === value
                        ? 'border-dorado bg-dorado/10 text-dorado'
                        : 'border-verde-borde text-gris-texto hover:border-dorado/50'
                      }
                    `}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Marcador opcional */}
          {winnerId && (
            <div>
              <p className="text-gris-texto text-xs uppercase tracking-widest mb-2 text-center">
                Marcador al {method === '90min' ? 'final' : method === 'extra_time' ? 'final del T. extra' : 'inicio de penales'}{' '}
                <span className="text-verde-borde">(opcional · +2 pts extra)</span>
              </p>
              <div className="flex items-center justify-center gap-4">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={kHomeScore}
                  onChange={(e) => setKHomeScore(e.target.value)}
                  placeholder="—"
                  className="w-14 text-center text-xl font-black text-white bg-verde-oscuro border border-verde-borde rounded-lg px-2 py-2 focus:outline-none focus:border-dorado transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-gris-texto font-black">–</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={kAwayScore}
                  onChange={(e) => setKAwayScore(e.target.value)}
                  placeholder="—"
                  className="w-14 text-center text-xl font-black text-white bg-verde-oscuro border border-verde-borde rounded-lg px-2 py-2 focus:outline-none focus:border-dorado transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback */}
      {error && (
        <p className="text-red-400 text-xs text-center mt-3">{error}</p>
      )}
      {success && (
        <p className="text-green-400 text-xs text-center mt-3 font-bold">
          ✓ Predicción guardada
        </p>
      )}

      {/* Submit */}
      <div className="mt-4 flex justify-center">
        <button
          type="submit"
          disabled={isPending || !canSubmit()}
          className="bg-dorado text-verde-oscuro text-xs font-black uppercase tracking-widest px-8 py-2.5 rounded hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          {isPending
            ? 'Guardando...'
            : existing
            ? 'Actualizar predicción'
            : 'Confirmar predicción'}
        </button>
      </div>
    </form>
  )
}
