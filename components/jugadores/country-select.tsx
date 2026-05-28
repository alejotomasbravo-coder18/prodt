'use client'

interface CountrySelectProps {
  countries: { id: number; name: string; code: string }[]
  currentCountry: number | null
  currentPos: string
}

export default function CountrySelect({
  countries,
  currentCountry,
  currentPos,
}: CountrySelectProps) {
  return (
    <form method="get" action="/jugadores">
      {currentPos !== 'ALL' && (
        <input type="hidden" name="pos" value={currentPos} />
      )}
      <select
        name="pais"
        onChange={(e) => (e.target.form as HTMLFormElement).submit()}
        defaultValue={currentCountry ?? ''}
        className="bg-verde-medio border border-verde-borde text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dorado transition-colors"
      >
        <option value="">Todos los países</option>
        {countries.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  )
}
