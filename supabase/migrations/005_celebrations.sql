-- ══════════════════════════════════════════════════════════
-- 005_celebrations.sql
-- Notificaciones de celebración + columnas Gran Campeón
-- ══════════════════════════════════════════════════════════

-- ── Tabla de notificaciones ────────────────────────────────
CREATE TABLE IF NOT EXISTS user_notifications (
  id          serial primary key,
  user_id     uuid references profiles(id) on delete cascade,
  type        text not null,
  -- tipos: 'date_winner' | 'points_earned' | 'rank_up' | 'exact_score' | 'champion'
  message     text not null,
  metadata    jsonb,
  seen        boolean default false,
  created_at  timestamptz default now()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_seen_idx
  ON user_notifications (user_id, seen, created_at DESC);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Solo el propio usuario puede ver y actualizar sus notificaciones
CREATE POLICY "Ver mis notificaciones"
  ON user_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Marcar notificaciones como vistas"
  ON user_notifications FOR UPDATE
  USING (user_id = auth.uid());

-- El service role puede insertar (desde server actions)
CREATE POLICY "Service inserta notificaciones"
  ON user_notifications FOR INSERT
  WITH CHECK (true);

-- ── Columnas Gran Campeón ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_global_champion boolean default false;

ALTER TABLE league_members
  ADD COLUMN IF NOT EXISTS is_league_champion boolean default false;
