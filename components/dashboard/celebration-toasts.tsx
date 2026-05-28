'use client'

/**
 * CelebrationToasts
 * Fetcha notificaciones no vistas al montar, las muestra como toasts
 * animados y dispara confetti para los eventos de primer nivel.
 * Se auto-destruye tras marcarlas como vistas.
 */

import { useEffect, useState, useCallback } from 'react'
import confetti from 'canvas-confetti'

interface Notification {
  id: number
  type: 'date_winner' | 'points_earned' | 'rank_up' | 'exact_score' | 'champion'
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

const TOAST_ICONS: Record<string, string> = {
  date_winner:   '🏆',
  points_earned: '⚽',
  rank_up:       '📈',
  exact_score:   '🎯',
  champion:      '👑',
}

const TOAST_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  date_winner:   { bg: '#1a2e0a', border: '#c8a84b', text: '#c8a84b' },
  points_earned: { bg: '#0d1f0f', border: '#4ade80', text: '#4ade80' },
  rank_up:       { bg: '#0d1525', border: '#60a5fa', text: '#60a5fa' },
  exact_score:   { bg: '#1a0d2e', border: '#c084fc', text: '#c084fc' },
  champion:      { bg: '#2e1a00', border: '#facc15', text: '#facc15' },
}

function fireConfetti(type: string) {
  if (type === 'date_winner' || type === 'champion') {
    confetti({
      particleCount: type === 'champion' ? 200 : 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#c8a84b', '#facc15', '#ffffff', '#4ade80'],
    })
    if (type === 'champion') {
      setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.4 } }), 400)
    }
  }
  if (type === 'exact_score') {
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.5 }, colors: ['#c084fc', '#ffffff'] })
  }
}

export default function CelebrationToasts() {
  const [toasts, setToasts] = useState<Notification[]>([])
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())

  const dismiss = useCallback((id: number) => {
    setDismissed((prev) => new Set([...prev, id]))
  }, [])

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then(({ notifications }: { notifications: Notification[] }) => {
        if (!notifications || notifications.length === 0) return
        setToasts(notifications)

        // Marcar como vistas en el server
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: notifications.map((n) => n.id) }),
        })

        // Disparar confetti para el más importante
        const priority = ['champion', 'date_winner', 'exact_score']
        for (const type of priority) {
          if (notifications.some((n) => n.type === type)) {
            setTimeout(() => fireConfetti(type), 500)
            break
          }
        }

        // Auto-dismiss después de 8s
        setTimeout(() => {
          setDismissed(new Set(notifications.map((n) => n.id)))
        }, 8000)
      })
      .catch(() => {/* silencioso si falla */})
  }, [])

  const visible = toasts.filter((t) => !dismissed.has(t.id))
  if (visible.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-4 z-50 flex flex-col gap-2 max-w-xs w-full"
      style={{ pointerEvents: 'none' }}
    >
      {visible.map((toast, idx) => {
        const colors = TOAST_COLORS[toast.type] ?? TOAST_COLORS.points_earned
        const icon   = TOAST_ICONS[toast.type] ?? '🎉'

        return (
          <div
            key={toast.id}
            className="rounded-lg px-4 py-3 flex items-start gap-3 shadow-2xl"
            style={{
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              pointerEvents: 'auto',
              animation: `slideInUp 0.4s ease ${idx * 0.1}s both`,
            }}
          >
            {/* Ícono */}
            <span className="text-xl shrink-0 mt-0.5">{icon}</span>

            {/* Mensaje */}
            <p
              className="flex-1 text-sm font-bold leading-snug"
              style={{ color: colors.text }}
            >
              {toast.message}
            </p>

            {/* Cerrar */}
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 text-white/40 hover:text-white/80 transition-colors text-lg leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        )
      })}

      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
