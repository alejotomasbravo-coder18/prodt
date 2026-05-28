import type { Player, Country } from '@/lib/types'
import type { Position } from '@/lib/formations'
import { POSITION_SHORT } from '@/lib/formations'

interface PlayerSlotProps {
  slot: number
  requiredPosition: Position
  player: (Player & { country?: Country }) | null
  isCaptain: boolean
  isSelected: boolean
  deadlinePassed: boolean
  onClick: () => void
}

// Mini camiseta SVG con colores del país (simplificada)
function MiniShirt({ flagUrl, countryCode }: { flagUrl: string | null; countryCode: string }) {
  return (
    <div className="relative w-9 h-9 flex items-center justify-center">
      {flagUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={flagUrl}
          alt={countryCode}
          className="w-8 h-auto rounded-sm shadow-md"
          loading="lazy"
        />
      ) : (
        <div className="w-8 h-8 rounded bg-verde-borde flex items-center justify-center">
          <span className="text-gris-texto text-xs font-bold">{countryCode.slice(0, 2)}</span>
        </div>
      )}
    </div>
  )
}

export default function PlayerSlot({
  slot,
  requiredPosition,
  player,
  isCaptain,
  isSelected,
  deadlinePassed,
  onClick,
}: PlayerSlotProps) {
  const isEmpty = !player

  return (
    <button
      onClick={onClick}
      disabled={deadlinePassed && isEmpty}
      className={`
        relative flex flex-col items-center gap-1 w-16 group
        transition-all duration-150
        ${deadlinePassed ? 'cursor-default' : 'cursor-pointer'}
      `}
      title={isEmpty ? `Agregar ${POSITION_SHORT[requiredPosition]}` : player!.name}
      aria-label={isEmpty ? `Slot ${slot}: agregar ${requiredPosition}` : player!.name}
    >
      {/* Slot visual */}
      <div
        className={`
          relative w-12 h-12 rounded-full flex items-center justify-center
          transition-all duration-150
          ${isEmpty
            ? `border-2 border-dashed ${isSelected ? 'border-dorado bg-dorado/10' : 'border-verde-borde bg-verde-oscuro/60'}`
            : `border-2 ${isSelected ? 'border-dorado shadow-lg shadow-dorado/30' : 'border-verde-cancha'} bg-verde-medio`
          }
          ${!deadlinePassed && !isEmpty ? 'group-hover:border-dorado/70' : ''}
          ${!deadlinePassed && isEmpty ? 'group-hover:border-dorado/60 group-hover:bg-dorado/5' : ''}
        `}
      >
        {isEmpty ? (
          <span className="text-verde-borde text-2xl font-thin leading-none group-hover:text-dorado/60 transition-colors">
            +
          </span>
        ) : (
          <MiniShirt
            flagUrl={player!.country?.flag_url ?? null}
            countryCode={player!.country?.code ?? '??'}
          />
        )}

        {/* Badge capitán */}
        {isCaptain && !isEmpty && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg z-10"
            style={{
              background: '#2563eb',
              fontFamily: 'Arial Black, Arial, sans-serif',
              fontSize: '9px',
            }}
          >
            C
          </span>
        )}

        {/* Borde dorado de selección */}
        {isSelected && (
          <span className="absolute inset-0 rounded-full border-2 border-dorado animate-pulse pointer-events-none" />
        )}
      </div>

      {/* Nombre del jugador */}
      <div className="w-full text-center">
        {isEmpty ? (
          <span className="text-verde-borde text-xs uppercase tracking-wider">
            {POSITION_SHORT[requiredPosition]}
          </span>
        ) : (
          <span className="text-white text-xs font-bold leading-tight block truncate max-w-[64px]">
            {shortName(player!.name)}
          </span>
        )}
      </div>
    </button>
  )
}

// Acortar nombre: "Lionel Messi" → "L. Messi"
function shortName(fullName: string): string {
  const parts = fullName.trim().split(' ')
  if (parts.length === 1) return fullName
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  if (lastName.length <= 8) return `${firstName[0]}. ${lastName}`
  return lastName.slice(0, 9) + '.'
}
