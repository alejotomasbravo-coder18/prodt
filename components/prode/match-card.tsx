import type { Match, ProdePrediction } from '@/lib/types'
import PredictionForm from './prediction-form'

interface MatchCardProps {
  match: Match
  prediction: ProdePrediction | null
}

// ── Helpers ──────────────────────────────────────────────────

function formatKickoff(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  const time = d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  return { date, time }
}

function isDeadlinePassed(kickoffAt: string): boolean {
  return new Date(kickoffAt) <= new Date()
}

function PredictionBadge({ prediction, phaseOrder }: { prediction: ProdePrediction; phaseOrder: number }) {
  if (phaseOrder === 1) {
    // Grupos
    if (prediction.pred_home_score === null) return null
    return (
      <div className="flex items-center justify-center gap-1 text-xs text-gris-texto">
        <span>Tu predicción:</span>
        <span className="font-black text-white">
          {prediction.pred_home_score} – {prediction.pred_away_score}
        </span>
        {prediction.evaluated && prediction.points_earned !== null && (
          <span className={`ml-2 font-black ${prediction.points_earned > 0 ? 'text-dorado' : 'text-gris-texto'}`}>
            {prediction.points_earned > 0 ? `+${prediction.points_earned} pts` : '0 pts'}
          </span>
        )}
      </div>
    )
  }

  // Eliminatorias
  if (!prediction.pred_winner_id) return null

  const methodLabel: Record<string, string> = {
    '90min':      '90\'',
    'extra_time': 'T. extra',
    'penalties':  'Penales',
  }

  return (
    <div className="text-xs text-gris-texto text-center space-y-0.5">
      <div>Tu predicción: ganador en {methodLabel[prediction.pred_method ?? '90min']}</div>
      {prediction.pred_score_method_home !== null && (
        <div className="text-white font-bold">
          {prediction.pred_score_method_home} – {prediction.pred_score_method_away}
        </div>
      )}
      {prediction.evaluated && prediction.points_earned !== null && (
        <div className={`font-black ${prediction.points_earned > 0 ? 'text-dorado' : 'text-gris-texto'}`}>
          {prediction.points_earned > 0 ? `+${prediction.points_earned} pts` : '0 pts'}
        </div>
      )}
    </div>
  )
}

function StatusChip({ status }: { status: Match['status'] }) {
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1 text-green-400 text-xs font-bold uppercase tracking-widest">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        En vivo
      </span>
    )
  }
  if (status === 'finished') {
    return (
      <span className="text-gris-texto text-xs uppercase tracking-widest">
        Finalizado
      </span>
    )
  }
  return null
}

// ── Componente principal ──────────────────────────────────────

export default function MatchCard({ match, prediction }: MatchCardProps) {
  if (!match.home_country || !match.away_country) return null

  const { date, time } = formatKickoff(match.kickoff_at)
  const deadlinePassed = isDeadlinePassed(match.kickoff_at)
  const phaseOrder = match.phase?.phase_order ?? 1
  const isFinished = match.status === 'finished'

  const hasResult =
    isFinished &&
    match.home_score_90 !== null &&
    match.away_score_90 !== null

  return (
    <div
      className={`
        bg-verde-medio border rounded-lg overflow-hidden transition-colors
        ${prediction && !deadlinePassed ? 'border-dorado/40' : 'border-verde-borde'}
        ${prediction?.evaluated && (prediction.points_earned ?? 0) > 0 ? 'border-dorado/60' : ''}
      `}
    >
      {/* Header con fecha y estado */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-verde-borde">
        <div className="text-gris-texto text-xs">
          <span className="capitalize">{date}</span>
          <span className="mx-1">·</span>
          <span>{time} hs</span>
        </div>
        <StatusChip status={match.status} />
      </div>

      {/* Cuerpo: equipos + marcador */}
      <div className="px-4 py-5">
        <div className="flex items-center justify-between gap-4">
          {/* Local */}
          <div className="flex flex-col items-center gap-2 flex-1">
            {match.home_country.flag_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={match.home_country.flag_url}
                alt={match.home_country.name}
                className="w-10 h-auto rounded-sm shadow"
              />
            )}
            <span className="text-white text-xs font-bold text-center leading-tight">
              {match.home_country.name}
            </span>
          </div>

          {/* Marcador / hora */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {hasResult ? (
              <div
                className="text-3xl font-black text-white"
                style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
              >
                {match.home_score_90} – {match.away_score_90}
              </div>
            ) : match.status === 'live' ? (
              <div
                className="text-3xl font-black text-green-400"
                style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
              >
                {match.home_score_90 ?? 0} – {match.away_score_90 ?? 0}
              </div>
            ) : (
              <div className="text-center">
                <div
                  className="text-dorado text-2xl font-black"
                  style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                >
                  {time}
                </div>
                <div className="text-gris-texto text-xs">hs</div>
              </div>
            )}

            {/* Tiempo extra / penales */}
            {isFinished && (match.went_to_penalties || match.went_to_et) && (
              <span className="text-gris-texto text-xs">
                {match.went_to_penalties ? '(pen.)' : '(t. ext.)'}
              </span>
            )}
          </div>

          {/* Visitante */}
          <div className="flex flex-col items-center gap-2 flex-1">
            {match.away_country.flag_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={match.away_country.flag_url}
                alt={match.away_country.name}
                className="w-10 h-auto rounded-sm shadow"
              />
            )}
            <span className="text-white text-xs font-bold text-center leading-tight">
              {match.away_country.name}
            </span>
          </div>
        </div>

        {/* Predicción actual (si la hay) */}
        {prediction && deadlinePassed && (
          <div className="mt-4 pt-3 border-t border-verde-borde">
            <PredictionBadge prediction={prediction} phaseOrder={phaseOrder} />
          </div>
        )}

        {/* Sin predicción y pasó el deadline */}
        {!prediction && deadlinePassed && match.status !== 'finished' && (
          <p className="text-gris-texto text-xs text-center mt-4 pt-3 border-t border-verde-borde">
            No predijiste este partido.
          </p>
        )}
      </div>

      {/* Formulario de predicción (solo si no pasó el deadline) */}
      {!deadlinePassed && (
        <div className="px-4 pb-5">
          <PredictionForm
            matchId={match.id}
            phaseOrder={phaseOrder}
            homeCountry={match.home_country}
            awayCountry={match.away_country}
            existing={prediction}
            deadlinePassed={deadlinePassed}
          />
        </div>
      )}
    </div>
  )
}
