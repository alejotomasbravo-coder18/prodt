-- ============================================================
-- ProDT — Seed data: Mundial 2026
-- 48 selecciones · Grupos A-L · 72 partidos de fase de grupos
-- ============================================================

-- ── SELECCIONES ─────────────────────────────────────────────
-- Flags via flagcdn.com (lowercase ISO 3166-1 alpha-2)

insert into countries (id, name, code, flag_url) values
  -- Grupo A
  (1,  'Estados Unidos', 'USA', 'https://flagcdn.com/w80/us.png'),
  (2,  'Panamá',         'PAN', 'https://flagcdn.com/w80/pa.png'),
  (3,  'Argelia',        'ALG', 'https://flagcdn.com/w80/dz.png'),
  (4,  'Rumania',        'ROU', 'https://flagcdn.com/w80/ro.png'),
  -- Grupo B
  (5,  'México',         'MEX', 'https://flagcdn.com/w80/mx.png'),
  (6,  'Colombia',       'COL', 'https://flagcdn.com/w80/co.png'),
  (7,  'Jamaica',        'JAM', 'https://flagcdn.com/w80/jm.png'),
  (8,  'Bolivia',        'BOL', 'https://flagcdn.com/w80/bo.png'),
  -- Grupo C
  (9,  'Canadá',         'CAN', 'https://flagcdn.com/w80/ca.png'),
  (10, 'Brasil',         'BRA', 'https://flagcdn.com/w80/br.png'),
  (11, 'Ecuador',        'ECU', 'https://flagcdn.com/w80/ec.png'),
  (12, 'Nueva Zelanda',  'NZL', 'https://flagcdn.com/w80/nz.png'),
  -- Grupo D
  (13, 'Argentina',      'ARG', 'https://flagcdn.com/w80/ar.png'),
  (14, 'Croacia',        'CRO', 'https://flagcdn.com/w80/hr.png'),
  (15, 'Nigeria',        'NGA', 'https://flagcdn.com/w80/ng.png'),
  (16, 'Corea del Sur',  'KOR', 'https://flagcdn.com/w80/kr.png'),
  -- Grupo E
  (17, 'Francia',        'FRA', 'https://flagcdn.com/w80/fr.png'),
  (18, 'Australia',      'AUS', 'https://flagcdn.com/w80/au.png'),
  (19, 'Japón',          'JPN', 'https://flagcdn.com/w80/jp.png'),
  (20, 'Marruecos',      'MAR', 'https://flagcdn.com/w80/ma.png'),
  -- Grupo F
  (21, 'España',         'ESP', 'https://flagcdn.com/w80/es.png'),
  (22, 'Alemania',       'GER', 'https://flagcdn.com/w80/de.png'),
  (23, 'Senegal',        'SEN', 'https://flagcdn.com/w80/sn.png'),
  (24, 'Perú',           'PER', 'https://flagcdn.com/w80/pe.png'),
  -- Grupo G
  (25, 'Inglaterra',     'ENG', 'https://flagcdn.com/w80/gb-eng.png'),
  (26, 'Países Bajos',   'NED', 'https://flagcdn.com/w80/nl.png'),
  (27, 'Turquía',        'TUR', 'https://flagcdn.com/w80/tr.png'),
  (28, 'Chile',          'CHI', 'https://flagcdn.com/w80/cl.png'),
  -- Grupo H
  (29, 'Portugal',       'POR', 'https://flagcdn.com/w80/pt.png'),
  (30, 'Italia',         'ITA', 'https://flagcdn.com/w80/it.png'),
  (31, 'Irán',           'IRN', 'https://flagcdn.com/w80/ir.png'),
  (32, 'Ghana',          'GHA', 'https://flagcdn.com/w80/gh.png'),
  -- Grupo I
  (33, 'Bélgica',        'BEL', 'https://flagcdn.com/w80/be.png'),
  (34, 'Dinamarca',      'DEN', 'https://flagcdn.com/w80/dk.png'),
  (35, 'Arabia Saudita', 'KSA', 'https://flagcdn.com/w80/sa.png'),
  (36, 'Sudáfrica',      'RSA', 'https://flagcdn.com/w80/za.png'),
  -- Grupo J
  (37, 'Polonia',        'POL', 'https://flagcdn.com/w80/pl.png'),
  (38, 'Suiza',          'SUI', 'https://flagcdn.com/w80/ch.png'),
  (39, 'Uruguay',        'URU', 'https://flagcdn.com/w80/uy.png'),
  (40, 'Camerún',        'CMR', 'https://flagcdn.com/w80/cm.png'),
  -- Grupo K
  (41, 'Serbia',         'SRB', 'https://flagcdn.com/w80/rs.png'),
  (42, 'Austria',        'AUT', 'https://flagcdn.com/w80/at.png'),
  (43, 'Honduras',       'HON', 'https://flagcdn.com/w80/hn.png'),
  (44, 'Egipto',         'EGY', 'https://flagcdn.com/w80/eg.png'),
  -- Grupo L
  (45, 'Venezuela',      'VEN', 'https://flagcdn.com/w80/ve.png'),
  (46, 'Costa Rica',     'CRC', 'https://flagcdn.com/w80/cr.png'),
  (47, 'Qatar',          'QAT', 'https://flagcdn.com/w80/qa.png'),
  (48, 'Túnez',          'TUN', 'https://flagcdn.com/w80/tn.png');

-- Resetear secuencia
select setval('countries_id_seq', 48);

-- ── PARTIDOS FASE DE GRUPOS (72) ────────────────────────────
-- Cada grupo: 4 equipos, 6 partidos (round-robin)
-- Jornada 1: 1v2, 3v4
-- Jornada 2: 1v3, 2v4
-- Jornada 3: 1v4, 2v3 (simultáneos dentro del grupo)

insert into matches (phase_id, home_country_id, away_country_id, kickoff_at) values

-- ══════════════════════════════════════
-- JORNADA 1 (June 11–16)
-- ══════════════════════════════════════

-- GRUPO A — June 11
(1,  1,  2, '2026-06-11 16:00:00+00'), -- USA vs Panamá
(1,  3,  4, '2026-06-11 22:00:00+00'), -- Argelia vs Rumania
-- GRUPO B — June 11
(1,  5,  6, '2026-06-11 19:00:00+00'), -- México vs Colombia
(1,  7,  8, '2026-06-12 01:00:00+00'), -- Jamaica vs Bolivia

-- GRUPO C — June 12
(1,  9, 10, '2026-06-12 16:00:00+00'), -- Canadá vs Brasil
(1, 11, 12, '2026-06-12 22:00:00+00'), -- Ecuador vs Nueva Zelanda
-- GRUPO D — June 12
(1, 13, 14, '2026-06-12 19:00:00+00'), -- Argentina vs Croacia
(1, 15, 16, '2026-06-13 01:00:00+00'), -- Nigeria vs Corea del Sur

-- GRUPO E — June 13
(1, 17, 18, '2026-06-13 16:00:00+00'), -- Francia vs Australia
(1, 19, 20, '2026-06-13 22:00:00+00'), -- Japón vs Marruecos
-- GRUPO F — June 13
(1, 21, 22, '2026-06-13 19:00:00+00'), -- España vs Alemania
(1, 23, 24, '2026-06-14 01:00:00+00'), -- Senegal vs Perú

-- GRUPO G — June 14
(1, 25, 26, '2026-06-14 16:00:00+00'), -- Inglaterra vs Países Bajos
(1, 27, 28, '2026-06-14 22:00:00+00'), -- Turquía vs Chile
-- GRUPO H — June 14
(1, 29, 30, '2026-06-14 19:00:00+00'), -- Portugal vs Italia
(1, 31, 32, '2026-06-15 01:00:00+00'), -- Irán vs Ghana

-- GRUPO I — June 15
(1, 33, 34, '2026-06-15 16:00:00+00'), -- Bélgica vs Dinamarca
(1, 35, 36, '2026-06-15 22:00:00+00'), -- Arabia Saudita vs Sudáfrica
-- GRUPO J — June 15
(1, 37, 38, '2026-06-15 19:00:00+00'), -- Polonia vs Suiza
(1, 39, 40, '2026-06-16 01:00:00+00'), -- Uruguay vs Camerún

-- GRUPO K — June 16
(1, 41, 42, '2026-06-16 16:00:00+00'), -- Serbia vs Austria
(1, 43, 44, '2026-06-16 22:00:00+00'), -- Honduras vs Egipto
-- GRUPO L — June 16
(1, 45, 46, '2026-06-16 19:00:00+00'), -- Venezuela vs Costa Rica
(1, 47, 48, '2026-06-17 01:00:00+00'), -- Qatar vs Túnez

-- ══════════════════════════════════════
-- JORNADA 2 (June 18–23)
-- ══════════════════════════════════════

-- GRUPO A — June 18
(1,  1,  3, '2026-06-18 16:00:00+00'), -- USA vs Argelia
(1,  2,  4, '2026-06-18 22:00:00+00'), -- Panamá vs Rumania
-- GRUPO B — June 18
(1,  5,  7, '2026-06-18 19:00:00+00'), -- México vs Jamaica
(1,  6,  8, '2026-06-19 01:00:00+00'), -- Colombia vs Bolivia

-- GRUPO C — June 19
(1,  9, 11, '2026-06-19 16:00:00+00'), -- Canadá vs Ecuador
(1, 10, 12, '2026-06-19 22:00:00+00'), -- Brasil vs Nueva Zelanda
-- GRUPO D — June 19
(1, 13, 15, '2026-06-19 19:00:00+00'), -- Argentina vs Nigeria
(1, 14, 16, '2026-06-20 01:00:00+00'), -- Croacia vs Corea del Sur

-- GRUPO E — June 20
(1, 17, 19, '2026-06-20 16:00:00+00'), -- Francia vs Japón
(1, 18, 20, '2026-06-20 22:00:00+00'), -- Australia vs Marruecos
-- GRUPO F — June 20
(1, 21, 23, '2026-06-20 19:00:00+00'), -- España vs Senegal
(1, 22, 24, '2026-06-21 01:00:00+00'), -- Alemania vs Perú

-- GRUPO G — June 21
(1, 25, 27, '2026-06-21 16:00:00+00'), -- Inglaterra vs Turquía
(1, 26, 28, '2026-06-21 22:00:00+00'), -- Países Bajos vs Chile
-- GRUPO H — June 21
(1, 29, 31, '2026-06-21 19:00:00+00'), -- Portugal vs Irán
(1, 30, 32, '2026-06-22 01:00:00+00'), -- Italia vs Ghana

-- GRUPO I — June 22
(1, 33, 35, '2026-06-22 16:00:00+00'), -- Bélgica vs Arabia Saudita
(1, 34, 36, '2026-06-22 22:00:00+00'), -- Dinamarca vs Sudáfrica
-- GRUPO J — June 22
(1, 37, 39, '2026-06-22 19:00:00+00'), -- Polonia vs Uruguay
(1, 38, 40, '2026-06-23 01:00:00+00'), -- Suiza vs Camerún

-- GRUPO K — June 23
(1, 41, 43, '2026-06-23 16:00:00+00'), -- Serbia vs Honduras
(1, 42, 44, '2026-06-23 22:00:00+00'), -- Austria vs Egipto
-- GRUPO L — June 23
(1, 45, 47, '2026-06-23 19:00:00+00'), -- Venezuela vs Qatar
(1, 46, 48, '2026-06-24 01:00:00+00'), -- Costa Rica vs Túnez

-- ══════════════════════════════════════
-- JORNADA 3 (June 25–30) — simultáneos dentro del grupo
-- ══════════════════════════════════════

-- GRUPO A — June 25 (simultáneo)
(1,  1,  4, '2026-06-25 20:00:00+00'), -- USA vs Rumania
(1,  2,  3, '2026-06-25 20:00:00+00'), -- Panamá vs Argelia
-- GRUPO B — June 25
(1,  5,  8, '2026-06-25 23:00:00+00'), -- México vs Bolivia
(1,  6,  7, '2026-06-25 23:00:00+00'), -- Colombia vs Jamaica

-- GRUPO C — June 26
(1,  9, 12, '2026-06-26 16:00:00+00'), -- Canadá vs Nueva Zelanda
(1, 10, 11, '2026-06-26 16:00:00+00'), -- Brasil vs Ecuador
-- GRUPO D — June 26
(1, 13, 16, '2026-06-26 20:00:00+00'), -- Argentina vs Corea del Sur
(1, 14, 15, '2026-06-26 20:00:00+00'), -- Croacia vs Nigeria

-- GRUPO E — June 27
(1, 17, 20, '2026-06-27 16:00:00+00'), -- Francia vs Marruecos
(1, 18, 19, '2026-06-27 16:00:00+00'), -- Australia vs Japón
-- GRUPO F — June 27
(1, 21, 24, '2026-06-27 20:00:00+00'), -- España vs Perú
(1, 22, 23, '2026-06-27 20:00:00+00'), -- Alemania vs Senegal

-- GRUPO G — June 28
(1, 25, 28, '2026-06-28 16:00:00+00'), -- Inglaterra vs Chile
(1, 26, 27, '2026-06-28 16:00:00+00'), -- Países Bajos vs Turquía
-- GRUPO H — June 28
(1, 29, 32, '2026-06-28 20:00:00+00'), -- Portugal vs Ghana
(1, 30, 31, '2026-06-28 20:00:00+00'), -- Italia vs Irán

-- GRUPO I — June 29
(1, 33, 36, '2026-06-29 16:00:00+00'), -- Bélgica vs Sudáfrica
(1, 34, 35, '2026-06-29 16:00:00+00'), -- Dinamarca vs Arabia Saudita
-- GRUPO J — June 29
(1, 37, 40, '2026-06-29 20:00:00+00'), -- Polonia vs Camerún
(1, 38, 39, '2026-06-29 20:00:00+00'), -- Suiza vs Uruguay

-- GRUPO K — June 30
(1, 41, 44, '2026-06-30 16:00:00+00'), -- Serbia vs Egipto
(1, 42, 43, '2026-06-30 16:00:00+00'), -- Austria vs Honduras
-- GRUPO L — June 30
(1, 45, 48, '2026-06-30 20:00:00+00'), -- Venezuela vs Túnez
(1, 46, 47, '2026-06-30 20:00:00+00'); -- Costa Rica vs Qatar

-- ══════════════════════════════════════
-- DIECISÉISAVOS (placeholders — se completan cuando terminen los grupos)
-- Los country IDs se actualizan vía admin panel tras la fase de grupos
-- ══════════════════════════════════════
insert into matches (phase_id, kickoff_at) values
  (2, '2026-07-04 17:00:00+00'), -- R32 1
  (2, '2026-07-04 21:00:00+00'), -- R32 2
  (2, '2026-07-05 17:00:00+00'), -- R32 3
  (2, '2026-07-05 21:00:00+00'), -- R32 4
  (2, '2026-07-06 17:00:00+00'), -- R32 5
  (2, '2026-07-06 21:00:00+00'), -- R32 6
  (2, '2026-07-07 17:00:00+00'), -- R32 7
  (2, '2026-07-07 21:00:00+00'), -- R32 8
  (2, '2026-07-08 17:00:00+00'), -- R32 9
  (2, '2026-07-08 21:00:00+00'), -- R32 10
  (2, '2026-07-09 17:00:00+00'), -- R32 11
  (2, '2026-07-09 21:00:00+00'), -- R32 12
  (2, '2026-07-10 17:00:00+00'), -- R32 13
  (2, '2026-07-10 21:00:00+00'), -- R32 14
  (2, '2026-07-11 17:00:00+00'), -- R32 15
  (2, '2026-07-11 21:00:00+00'), -- R32 16

-- CUARTOS DE FINAL
  (3, '2026-07-14 21:00:00+00'), -- QF 1
  (3, '2026-07-15 17:00:00+00'), -- QF 2
  (3, '2026-07-15 21:00:00+00'), -- QF 3
  (3, '2026-07-16 17:00:00+00'), -- QF 4
  (3, '2026-07-16 21:00:00+00'), -- QF 5
  (3, '2026-07-17 17:00:00+00'), -- QF 6
  (3, '2026-07-17 21:00:00+00'), -- QF 7
  (3, '2026-07-18 21:00:00+00'), -- QF 8

-- SEMIFINALES
  (4, '2026-07-21 21:00:00+00'), -- SF 1
  (4, '2026-07-22 21:00:00+00'), -- SF 2
  (4, '2026-07-24 17:00:00+00'), -- SF 3
  (4, '2026-07-24 21:00:00+00'), -- SF 4

-- FINAL
  (5, '2026-07-26 21:00:00+00'); -- THE FINAL
