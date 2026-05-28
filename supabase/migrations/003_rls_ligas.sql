-- ============================================================
-- Migración 003: RLS Ligas + Vistas de Ranking corregidas
--
-- Problemas que resuelve:
--   1. leagues y league_members no tenían RLS habilitado →
--      cualquier usuario podía leer/escribir datos de otros.
--   2. La política SELECT de league_members se autorreferenciaba
--      causando recursión infinita.
--   3. Las vistas global_ranking y league_ranking corrían con
--      security_invoker=on (default Supabase), lo que aplicaba
--      la política "Solo puntos propios" de user_match_scores y
--      devolvía 0 puntos para todos menos el usuario actual.
-- ============================================================

-- ── 1. Función helper SECURITY DEFINER ─────────────────────
-- Corre como el dueño de la función (postgres superuser),
-- no como el usuario que la invoca → no hay recursión circular.

CREATE OR REPLACE FUNCTION public.is_league_member(league_id_param integer)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM league_members
    WHERE league_id = league_id_param
      AND user_id = auth.uid()
  );
$$;

-- ── 2. Habilitar RLS en leagues y league_members ────────────

ALTER TABLE leagues        ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- ── 3. Limpiar políticas previas (por si existen) ───────────

DROP POLICY IF EXISTS "Crear liga"            ON leagues;
DROP POLICY IF EXISTS "Ver ligas propias"     ON leagues;
DROP POLICY IF EXISTS "Admin de liga"         ON leagues;
DROP POLICY IF EXISTS "Borrar liga"           ON leagues;

DROP POLICY IF EXISTS "Ver miembros de liga"  ON league_members;
DROP POLICY IF EXISTS "Unirse a liga"         ON league_members;
DROP POLICY IF EXISTS "Salir de liga"         ON league_members;

-- ── 4. Políticas para leagues ───────────────────────────────

-- Cualquier autenticado puede crear una liga
CREATE POLICY "Crear liga" ON leagues
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- El creador puede ver SU liga aunque todavía no sea miembro
-- (resuelve el problema de .insert().select() encadenado)
CREATE POLICY "Ver ligas propias" ON leagues
  FOR SELECT USING (
    auth.uid() = created_by
    OR public.is_league_member(id)
  );

CREATE POLICY "Admin de liga" ON leagues
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Borrar liga" ON leagues
  FOR DELETE USING (auth.uid() = created_by);

-- ── 5. Políticas para league_members ───────────────────────

-- Ver miembros usando la función helper (sin recursión)
CREATE POLICY "Ver miembros de liga" ON league_members
  FOR SELECT USING (public.is_league_member(league_id));

-- Cualquier autenticado puede insertarse a sí mismo
CREATE POLICY "Unirse a liga" ON league_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Uno mismo puede salirse; el creador puede expulsar
CREATE POLICY "Salir de liga" ON league_members
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM leagues
      WHERE id = league_id AND created_by = auth.uid()
    )
  );

-- ── 6. Recrear vistas de ranking con security_invoker=false ─
-- security_invoker=false → la vista corre con los permisos del
-- dueño (postgres superuser) → bypassa RLS de user_match_scores
-- → puede agregar puntos de TODOS los usuarios para el ranking.

DROP VIEW IF EXISTS league_ranking;
DROP VIEW IF EXISTS global_ranking;

CREATE VIEW global_ranking
  WITH (security_invoker = false)
AS
SELECT
  p.id            AS user_id,
  p.username,
  p.display_name,
  COALESCE(SUM(s.gran_dt_points + s.captain_bonus), 0) AS gran_dt_total,
  COALESCE(SUM(s.prode_points), 0)                     AS prode_total,
  COALESCE(SUM(s.total_points), 0)                     AS total_points,
  RANK() OVER (ORDER BY COALESCE(SUM(s.total_points), 0) DESC) AS rank
FROM profiles p
LEFT JOIN user_match_scores s ON s.user_id = p.id
GROUP BY p.id, p.username, p.display_name;

CREATE VIEW league_ranking
  WITH (security_invoker = false)
AS
SELECT
  lm.league_id,
  p.id            AS user_id,
  p.username,
  p.display_name,
  COALESCE(SUM(s.total_points), 0) AS total_points,
  RANK() OVER (
    PARTITION BY lm.league_id
    ORDER BY COALESCE(SUM(s.total_points), 0) DESC
  ) AS rank
FROM league_members lm
JOIN profiles p ON p.id = lm.user_id
LEFT JOIN user_match_scores s ON s.user_id = lm.user_id
GROUP BY lm.league_id, p.id, p.username, p.display_name;
