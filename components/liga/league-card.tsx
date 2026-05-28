'use client'

import { useTransition, useState } from 'react'
import { leaveLeague, deleteLeague, updateLeague } from '@/app/actions/liga'

interface RankingRow {
  user_id: string
  username: string
  display_name: string | null
  total_points: number
  rank: number
}

interface LeagueCardProps {
  league: {
    id: number
    name: string
    invite_code: string
    rules_text: string | null
    prizes_text: string | null
    created_by: string
    member_count: number
    user_role: 'admin' | 'member'
    user_rank?: number | null
    user_points?: number
  }
  currentUserId: string
  rankingRows?: RankingRow[]
}

export default function LeagueCard({
  league,
  currentUserId,
  rankingRows = [],
}: LeagueCardProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState(league.name)
  const [editRules, setEditRules] = useState(league.rules_text ?? '')
  const [editPrizes, setEditPrizes] = useState(league.prizes_text ?? '')

  const isCreator = league.created_by === currentUserId
  const isAdmin = league.user_role === 'admin'

  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_BASE_URL ?? ''

  function handleCopyLink() {
    const link = `${baseUrl}/unirse?codigo=${league.invite_code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function handleLeave() {
    if (!confirm(`¿Salir de "${league.name}"?`)) return
    setError(null)
    startTransition(async () => {
      const result = await leaveLeague(league.id)
      if (result.error) setError(result.error)
    })
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar la liga "${league.name}"? Esta acción no se puede deshacer.`)) return
    setError(null)
    startTransition(async () => {
      const result = await deleteLeague(league.id)
      if (result.error) setError(result.error)
    })
  }

  function handleSaveEdit() {
    setError(null)
    startTransition(async () => {
      const result = await updateLeague(league.id, {
        name: editName,
        rules_text: editRules || null,
        prizes_text: editPrizes || null,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess('Liga actualizada.')
        setEditing(false)
        setTimeout(() => setSuccess(null), 3000)
      }
    })
  }

  return (
    <div className="bg-verde-medio border border-verde-borde rounded-lg overflow-hidden">

      {/* ── Header ── */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="text-white font-black text-base"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              {league.name}
            </h3>
            {isAdmin && (
              <span className="text-xs bg-azul-lazar text-dorado px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                Admin
              </span>
            )}
          </div>
          <p className="text-gris-texto text-xs mt-0.5">
            {league.member_count} miembro{league.member_count !== 1 ? 's' : ''}
            {league.user_rank != null && (
              <span className="ml-2 text-dorado font-bold">
                · #{league.user_rank} — {league.user_points ?? 0} pts
              </span>
            )}
          </p>
        </div>

        {/* Copiar link de invitación */}
        <button
          onClick={handleCopyLink}
          className={`shrink-0 text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded transition-all border ${
            copied
              ? 'bg-green-600/20 border-green-500/50 text-green-400'
              : 'bg-dorado/10 border-dorado/40 text-dorado hover:bg-dorado/20'
          }`}
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          {copied ? '✓ Copiado' : '🔗 Invitar'}
        </button>
      </div>

      {/* ── Código de invitación visible ── */}
      <div
        className="mx-4 mb-3 flex items-center gap-3 bg-verde-oscuro/50 rounded px-3 py-2"
        style={{ border: '1px solid #1a3b1e' }}
      >
        <span className="text-gris-texto text-xs uppercase tracking-widest shrink-0">Código</span>
        <span
          className="text-dorado font-black tracking-widest text-base"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
        >
          {league.invite_code}
        </span>
        <span className="text-gris-texto text-xs ml-auto truncate hidden sm:block opacity-50">
          /unirse?codigo={league.invite_code}
        </span>
      </div>

      {/* ── Reglas y Premios ── */}
      {(league.rules_text || league.prizes_text) && !editing && (
        <div className="mx-4 mb-3 space-y-2">
          {league.rules_text && (
            <div className="bg-verde-oscuro/40 rounded px-3 py-2" style={{ border: '1px solid #1a3b1e' }}>
              <p className="text-gris-texto text-xs uppercase tracking-widest mb-1">Reglas</p>
              <p className="text-white/80 text-sm leading-relaxed">{league.rules_text}</p>
            </div>
          )}
          {league.prizes_text && (
            <div className="bg-verde-oscuro/40 rounded px-3 py-2" style={{ border: '1px solid #1a3b1e' }}>
              <p className="text-gris-texto text-xs uppercase tracking-widest mb-1">Premio</p>
              <p className="text-dorado text-sm font-bold">{league.prizes_text}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Formulario de edición (solo admin) ── */}
      {editing && (
        <div className="mx-4 mb-3 space-y-3 border border-dorado/30 rounded-lg p-4 bg-verde-oscuro/30">
          <p
            className="text-dorado text-xs font-black uppercase tracking-widest"
            style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
          >
            Editar liga
          </p>

          <div className="space-y-1">
            <label className="text-gris-texto text-xs uppercase tracking-widest">Nombre</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={50}
              className="w-full bg-verde-oscuro border border-verde-borde rounded px-3 py-2 text-white text-sm placeholder:text-gris-texto focus:outline-none focus:border-dorado/60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-gris-texto text-xs uppercase tracking-widest">Reglas (opcional)</label>
            <textarea
              value={editRules}
              onChange={(e) => setEditRules(e.target.value)}
              rows={2}
              placeholder="Ej: Sin cambios en cuartos de final"
              className="w-full bg-verde-oscuro border border-verde-borde rounded px-3 py-2 text-white text-sm placeholder:text-gris-texto focus:outline-none focus:border-dorado/60 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-gris-texto text-xs uppercase tracking-widest">Premio (opcional)</label>
            <input
              type="text"
              value={editPrizes}
              onChange={(e) => setEditPrizes(e.target.value)}
              placeholder="Ej: Cena para 2 en Lo de Carlitos"
              className="w-full bg-verde-oscuro border border-verde-borde rounded px-3 py-2 text-white text-sm placeholder:text-gris-texto focus:outline-none focus:border-dorado/60"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSaveEdit}
              disabled={isPending}
              className="flex-1 text-xs font-black uppercase tracking-widest bg-dorado text-verde-oscuro rounded px-3 py-2 hover:bg-dorado/90 transition-colors disabled:opacity-50"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              {isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null) }}
              disabled={isPending}
              className="text-xs text-gris-texto border border-verde-borde rounded px-3 py-2 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Ranking de la liga ── */}
      {rankingRows.length > 0 && (
        <div className="border-t border-verde-borde">
          <div className="px-4 py-2 flex items-center justify-between">
            <span
              className="text-xs font-black uppercase tracking-widest text-gris-texto"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >
              Ranking
            </span>
            <a
              href={`/ranking?liga=${league.id}`}
              className="text-xs text-dorado hover:text-white transition-colors"
            >
              Ver completo →
            </a>
          </div>

          <div className="pb-1">
            {rankingRows.slice(0, 5).map((row, idx) => {
              const isMe = row.user_id === currentUserId
              return (
                <div
                  key={row.user_id}
                  className={`flex items-center gap-3 px-4 py-2 ${
                    isMe ? 'bg-dorado/5' : ''
                  }`}
                >
                  {/* Rank */}
                  <span
                    className={`w-5 shrink-0 text-sm font-black tabular-nums text-center ${
                      idx === 0 ? 'text-yellow-400' :
                      idx === 1 ? 'text-gray-300' :
                      idx === 2 ? 'text-orange-400' :
                      'text-gris-texto'
                    }`}
                    style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                  >
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : row.rank}
                  </span>

                  {/* Nombre */}
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-white text-sm font-bold truncate">
                      {row.display_name || row.username}
                    </span>
                    {isMe && (
                      <span className="shrink-0 text-xs bg-dorado text-verde-oscuro font-black px-1.5 py-0 rounded">
                        Vos
                      </span>
                    )}
                  </div>

                  {/* Puntos */}
                  <span
                    className="shrink-0 text-dorado text-sm font-black tabular-nums"
                    style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                  >
                    {row.total_points} <span className="text-gris-texto font-normal text-xs">pts</span>
                  </span>
                </div>
              )
            })}

            {/* Si el usuario está fuera del top 5, mostrarlo igual */}
            {(() => {
              const myRow = rankingRows.find((r) => r.user_id === currentUserId)
              if (!myRow || myRow.rank <= 5) return null
              return (
                <>
                  <div className="flex items-center justify-center py-1">
                    <span className="text-gris-texto text-xs">···</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 bg-dorado/5">
                    <span
                      className="w-5 shrink-0 text-sm font-black tabular-nums text-center text-gris-texto"
                      style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                    >
                      {myRow.rank}
                    </span>
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className="text-white text-sm font-bold truncate">
                        {myRow.display_name || myRow.username}
                      </span>
                      <span className="shrink-0 text-xs bg-dorado text-verde-oscuro font-black px-1.5 py-0 rounded">
                        Vos
                      </span>
                    </div>
                    <span
                      className="shrink-0 text-dorado text-sm font-black tabular-nums"
                      style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
                    >
                      {myRow.total_points} <span className="text-gris-texto font-normal text-xs">pts</span>
                    </span>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Si no hay puntos aún, mostrar lista simple de miembros */}
      {rankingRows.length === 0 && league.member_count > 0 && (
        <div className="border-t border-verde-borde px-4 py-3">
          <p className="text-gris-texto text-xs text-center">
            El ranking aparece cuando se publiquen los primeros puntos.
          </p>
        </div>
      )}

      {/* ── Feedback ── */}
      {error && (
        <div className="mx-4 mb-3 text-red-400 text-xs bg-red-950/40 border border-red-800 rounded px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="mx-4 mb-3 text-green-400 text-xs bg-green-950/40 border border-green-700 rounded px-3 py-2">
          {success}
        </div>
      )}

      {/* ── Acciones del footer ── */}
      <div className="border-t border-verde-borde px-4 py-2.5 flex gap-2 items-center">
        {isAdmin && !editing && (
          <button
            onClick={() => { setEditing(true); setError(null); setSuccess(null) }}
            className="text-xs text-gris-texto hover:text-white border border-verde-borde rounded px-3 py-1.5 transition-colors"
          >
            ✏ Editar
          </button>
        )}

        <div className="flex-1" />

        {isCreator ? (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs text-red-400 hover:text-red-300 border border-red-800/40 rounded px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Eliminando...' : 'Eliminar liga'}
          </button>
        ) : (
          <button
            onClick={handleLeave}
            disabled={isPending}
            className="text-xs text-gris-texto hover:text-red-400 border border-verde-borde rounded px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Saliendo...' : 'Salir de la liga'}
          </button>
        )}
      </div>
    </div>
  )
}
