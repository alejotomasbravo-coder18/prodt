import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ProDT · Gran DT y Prode del Mundial 2026',
  description:
    'Jugá el Gran DT y el Prode del Mundial 2026. Armá tu equipo, predecí los partidos y competí con tus amigos.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
