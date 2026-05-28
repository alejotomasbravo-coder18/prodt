-- ============================================================
-- Migración 004: Caché de noticias RSS del Mundial
--
-- Guarda los items del feed RSS en la base de datos para
-- evitar llamadas externas en cada request. TTL: 30 minutos.
-- ============================================================

CREATE TABLE news_items (
  id          serial primary key,
  guid        text unique not null,   -- GUID del item RSS o URL como fallback
  title       text not null,
  link        text not null,
  description text,
  source      text,                   -- nombre del medio / fuente
  pub_date    timestamptz,
  fetched_at  timestamptz default now()
);

-- Índice para consultas de TTL (buscar el fetch más reciente)
CREATE INDEX news_items_fetched_at_idx ON news_items (fetched_at DESC);

-- Índice para ordenar por fecha de publicación
CREATE INDEX news_items_pub_date_idx ON news_items (pub_date DESC);

-- RLS: lectura pública (noticias no son datos sensibles)
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Noticias públicas" ON news_items
  FOR SELECT USING (true);

-- Solo el service role puede escribir (no hay política INSERT para anon/authenticated)
-- Las escrituras vienen siempre desde el API route con service_role_key
