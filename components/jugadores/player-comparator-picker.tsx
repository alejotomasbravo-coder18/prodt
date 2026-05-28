'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface PlayerOption {
  id: number
  name: string
  position: string
  country_name: string | null
  flag_url: string | null
  total_points: number
}

interface PlayerComparatorPickerProps {
  players: PlayerOption[]
  initialA: number | null
  initialB: number | null
}

const POS_LABELS: Record<string, string> = {
  GK: 'ARQ', DEF: 'DEF', MID: 'MED', FWD: 'DEL',
}

function PlayerPickerPanel({
  label,
  players,
  selectedId,
  otherId,
  onSelect,
}: {
  label: string
  players: PlayerOption[]
  selectedId: number | null
  otherId: number | null
  onSelect: (id: number | null) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(!selectedId)

  const filtered = useMemo(() =>
    players
      .filter(
        (p) =>
          p.id !== otherId &&
          (!query || p.name.toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, 20),
    [players, query, otherId]
  )

  const selected = players.find((p) => p.id === selectedId)

  if (selected && !open) {
    return (
      <div className="flex-1">
        <p className="text-gris-texto text-xs font-black uppercase tracking-widest mb-2"
          style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}>
          {label}
        </p>
        <div
          className="bg-verde-medio border border-dorado/50 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-dorado transition-colors"
          onClick={() => setOpen(true)}
        >
          {selected.flag_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={selected.flag_url} alt="" className="w-7 h-auto rounded-sm shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold truncate">{selected.name}</div>
            <div className="text-gris-texto text-xs">{selected.country_name} · {POS_LABELS[selected.position] ?? selected.position}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-dorado font-black text-lg"
              style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}>
              {selected.total_points}
            </div>
            <div className="text-gris-texto text-xs">pts</div>
          </div>
          <span className="text-gris-texto text-xs ml-1">✎</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <p className="text-gris-texto text-xs font-black uppercase tracking-widest mb-2"
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}>
        {label}
      </p>
      <div className="bg-verde-medio border border-verde-borde rounded-lg overflow-hidden">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar jugador..."
          autoFocus={open}
          className="w-full bg-transparent border-b border-verde-borde text-white px-4 py-2.5 text-sm focus:outline-none focus:border-dorado transition-colors placeholder:text-gris-texto"
        />
        <div className="max-h-52 overflow-y-auto divide-y divide-verde-borde">
          {filtered.length === 0 && (
            <p className="text-gris-texto text-sm text-center py-4 px-4">Sin resultados</p>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-verde-cancha/20 transition-colors text-left"
            >
              {p.flag_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.flag_url} alt="" className="w-6 h-auto rounded-sm shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-white text-sm font-bold truncate block">{p.name}</span>
                <span className="text-gris-texto text-xs">{p.country_name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {p.total_points > 0 && (
                  <span className="text-dorado text-xs font-black"
                    style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}>
                    {p.total_points}pts
                  </span>
                )}
                <span className="text-xs font-black px-1.5 py-0 rounded bg-verde-borde text-gris-texto"
                  style={{ fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '9px' }}>
                  {POS_LABELS[p.position] ?? p.position}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <button
          onClick={() => setOpen(false)}
          className="mt-1 text-gris-texto text-xs hover:text-white transition-colors"
        >
          ← Volver a {selected.name}
        </button>
      )}
    </div>
  )
}

export default function PlayerComparatorPicker({
  players,
  initialA,
  initialB,
}: PlayerComparatorPickerProps) {
  const [playerA, setPlayerA] = useState<number | null>(initialA)
  const [playerB, setPlayerB] = useState<number | null>(initialB)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleCompare() {
    if (!playerA || !playerB) return
    startTransition(() => {
      router.push(`/jugadores/comparar?a=${playerA}&b=${playerB}`)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <PlayerPickerPanel
          label="Jugador A"
          players={players}
          selectedId={playerA}
          otherId={playerB}
          onSelect={setPlayerA}
        />

        <div className="flex items-center justify-center text-gris-texto font-black text-lg sm:mt-7">VS</div>

        <PlayerPickerPanel
          label="Jugador B"
          players={players}
          selectedId={playerB}
          otherId={playerA}
          onSelect={setPlayerB}
        />
      </div>

      <button
        onClick={handleCompare}
        disabled={!playerA || !playerB || isPending}
        className="w-full sm:w-auto bg-dorado text-verde-oscuro text-xs font-black uppercase tracking-widest px-8 py-3 rounded hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
      >
        {isPending ? 'Comparando...' : 'Comparar'}
      </button>
    </div>
  )
}
