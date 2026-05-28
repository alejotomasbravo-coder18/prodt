-- ============================================================
-- Migración 002: Suplentes Gran DT
--
-- Agrega 4 slots de suplentes (slots 12-15) al equipo Gran DT:
--   Slot 12 → ARQ suplente
--   Slot 13 → DEF suplente
--   Slot 14 → MID suplente
--   Slot 15 → FWD suplente
--
-- También agrega el event_type 'did_not_play' para marcar
-- titulares que no jugaron (activa su suplente automáticamente).
-- ============================================================

-- 1. Ampliar el check constraint de slots (1-11 → 1-15)
ALTER TABLE user_team_players
  DROP CONSTRAINT user_team_players_slot_check;

ALTER TABLE user_team_players
  ADD CONSTRAINT user_team_players_slot_check
  CHECK (slot BETWEEN 1 AND 15);

-- 2. Agregar did_not_play como event_type válido
ALTER TABLE match_events
  DROP CONSTRAINT match_events_event_type_check;

ALTER TABLE match_events
  ADD CONSTRAINT match_events_event_type_check
  CHECK (event_type IN (
    'goal', 'assist', 'yellow_card', 'red_card',
    'own_goal', 'penalty_saved', 'clean_sheet', 'mvp',
    'did_not_play'
  ));
