# PRODT — PROMPT MAESTRO v2.0
## Iteración sobre prototipo funcional · Mundial 2026

---

## CONTEXTO

ProDT es una plataforma web de Gran DT y Prode del Mundial 2026 ya construida y funcionando.
Esta es la v2.0 — no se construye desde cero, se itera sobre el código existente en `C:\Users\alejo\prodt`.

Stack: Next.js 14 · Supabase · Tailwind · Vercel
Referencia visual: Classic Football Shirts (oscuro, dorado, bold, moderno)

Antes de tocar cualquier archivo, leé el código existente para entender la estructura actual.
No rompas lo que funciona. Cada tarea tiene un alcance claro — no agregues nada fuera de scope.

---

## PRIORIDAD 1 — BUGS PENDIENTES (hacer primero)

### 1.1 Liga privada — UI completa
La liga se crea y el código de invitación funciona, pero falta:
- Página `/liga` muestra la liga del usuario con: nombre, código, botón "Copiar link de invitación"
- El link copiado debe ser: `[URL_BASE]/unirse?codigo=XXXX`
- Página `/unirse?codigo=XXXX` pública: muestra nombre de la liga, cantidad de miembros, botón "Unirme"
- Lista de miembros visible dentro de la liga (solo nombre y puntos, NO el equipo)
- Editar nombre, reglas y premios de la liga (solo el admin de la liga puede hacerlo)
- Botón para abandonar la liga (excepto el creador)

### 1.2 Momentos de celebración — UI
Cuando el usuario entra al dashboard, mostrar banners/toasts para:
- 🏆 "Ganaste la fecha X" → copetín animado en el ranking junto a su nombre
- ⚽ "Tus jugadores sumaron N puntos este partido"
- 📈 "Subiste N posiciones en el ranking global"
- 🎯 "Acertaste el marcador exacto" (prode)
- Estos eventos se guardan en tabla `user_notifications` y se marcan como vistos

```sql
-- Agregar a migraciones
CREATE TABLE user_notifications (
  id serial primary key,
  user_id uuid references profiles(id),
  type text not null, -- 'date_winner', 'points_earned', 'rank_up', 'exact_score'
  message text not null,
  metadata jsonb,
  seen boolean default false,
  created_at timestamptz default now()
);
```

---

## PRIORIDAD 2 — FEATURES NUEVAS

### 2.1 Rendimiento acumulado por jugador
- En la cancha del Gran DT, cada jugador muestra sus puntos totales acumulados en el torneo
- Al buscar jugadores en el sidebar, ordenar por puntos acumulados (descendente) por defecto
- Columna `total_points` calculada como vista o agregado desde `player_match_points`

### 2.2 Forma reciente — semáforo
- Cada jugador muestra un semáforo de sus últimos 3 partidos:
  - 🟢 Verde: sumó 6+ puntos
  - 🟡 Amarillo: sumó 1-5 puntos
  - 🔴 Rojo: sumó 0 puntos o no jugó
- Visible en el sidebar de búsqueda y en la cancha al hacer hover

### 2.3 Comparador de jugadores
- Sección dentro de `/gran-dt` o página `/comparar`
- Elegís dos jugadores y ves lado a lado:
  - Puntos totales en el torneo
  - Goles, asistencias, vallas invictas, MVPs
  - Forma últimos 3 partidos (semáforo)
  - En cuántos equipos de la liga está cada uno (%)

### 2.4 "Más elegidos en tu liga"
- Widget en el dashboard: top 5 jugadores más elegidos dentro de tu liga privada
- Muestra: nombre del jugador, bandera, posición, % de equipos que lo tienen
- NO revela en qué equipo específico está — solo el porcentaje global de la liga

### 2.5 Feed de noticias del Mundial
- Widget en el dashboard principal (columna derecha o sección inferior)
- Fuentes RSS a consumir:
  - TyC Sports: `https://www.tycsports.com/rss`
  - ESPN Argentina: `https://www.espn.com.ar/rss`
  - Infobae Deportes: `https://www.infobae.com/feeds/rss/deportes/`
- Mostrar: imagen, titular, fuente, hace cuánto tiempo
- Filtrar por keywords: "Mundial", "FIFA", "selección"
- Actualización cada 30 minutos via API route `/api/fetch-news`
- Guardar en tabla `news_cache` para no spamear las fuentes

```sql
CREATE TABLE news_cache (
  id serial primary key,
  title text not null,
  summary text,
  image_url text,
  source text,
  original_url text,
  published_at timestamptz,
  fetched_at timestamptz default now()
);
```

### 2.6 Planificador de cambios
- Widget en `/gran-dt`: "Si usás tus N cambios ahora vs guardarlos"
- Muestra cuántos partidos quedan en la fase actual
- Sugiere: "Quedan 3 partidos en grupos, tenés 5 cambios — podés usar 2 ahora y guardar 3 para dieciséisavos"
- Lógica simple basada en cambios disponibles / partidos restantes de la fase

### 2.7 Ranking global con Gran Campeón
- Página `/ranking` ya existe — mejorarla:
  - Tab "Global" y tab "Mi Liga"
  - Top 3 con diseño especial: 🥇🥈🥉 con fondo destacado
  - Al finalizar el torneo (último partido jugado), el #1 global se marca como "Gran Campeón" con trofeo permanente
  - El #1 de cada liga privada se marca como "Campeón de Liga"
  - Estos títulos quedan en el perfil para siempre

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  is_global_champion boolean default false;
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS
  is_league_champion boolean default false;
```

### 2.8 Notificaciones por email — 30 min antes del partido
- Al registrarse, el usuario tiene notificaciones activadas por defecto
- En `/perfil` o settings: toggle "Recibir avisos de partidos por email" (activado por defecto)
- El cron job existente (cada 30 min) verifica si hay partidos en los próximos 30 minutos
- Si hay, envía email a todos los usuarios con notificaciones activas que tienen jugadores en ese partido
- Email incluye: nombre del partido, hora, jugadores del usuario que juegan, cambios disponibles
- Usar Resend (resend.com) para envío de emails — gratis hasta 3000 emails/mes

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  email_notifications boolean default true;
```

Variables de entorno a agregar:
```
RESEND_API_KEY=tu-key-de-resend
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## PRIORIDAD 3 — EXPERIENCIA Y DISEÑO

### 3.1 Navegación pro
- Navbar con indicador activo animado (underline que se desliza)
- En mobile: bottom navigation bar con íconos (Dashboard, Gran DT, Prode, Ranking, Liga)
- Breadcrumbs en páginas internas
- Loading skeletons en lugar de spinners en todas las páginas
- Transiciones suaves entre páginas (View Transitions API o Framer Motion)

### 3.2 Dashboard rediseñado
Layout de 3 columnas en desktop:
```
┌─────────────────┬──────────────┬────────────────┐
│  Métricas       │  Próximo     │  Feed noticias │
│  personales     │  partido     │                │
├─────────────────┼──────────────┤                │
│  Ranking liga   │  Últimos     │                │
│  (top 5)        │  partidos    │                │
├─────────────────┴──────────────┤                │
│  Más elegidos en tu liga       │                │
│  Cambios disponibles           │                │
└────────────────────────────────┴────────────────┘
```

### 3.3 Momentos de celebración — Animaciones
- Confetti al ganar una fecha (usar `canvas-confetti`)
- Toast notifications con íconos animados para cada logro
- El copetín 🏆 en el ranking es un badge dorado animado (pulse) que aparece 24hs tras ganar la fecha
- Hover en jugadores de la cancha: mini card con stats flotante

### 3.4 Perfil de usuario
- Página `/perfil` con:
  - Avatar (iniciales con color único generado por username)
  - Estadísticas del torneo: partidas, puntos totales, mejor fecha, exactos en el prode
  - Logros desbloqueados con fecha
  - Toggle de notificaciones por email
  - Historial de cambios realizados

### 3.5 Micro-interacciones
- Slots de la cancha: animación de "pop" al agregar jugador
- Ranking: números animados al actualizarse los puntos
- Cambios: contador con animación al descontar un cambio
- Prode: checkbox animado al confirmar predicción

---

## PRIORIDAD 4 — OPERACIÓN Y ADMIN

### 4.1 Panel admin mejorado
- `/admin` dashboard con: usuarios registrados, ligas activas, último partido procesado, errores recientes
- Poder marcar manualmente el fin del torneo (activa el Gran Campeón)
- Log de todos los puntos publicados con opción de revertir
- Vista de "partidos pendientes de procesar"

### 4.2 Deploy en Vercel
Al finalizar todas las prioridades anteriores:
- Configurar proyecto en Vercel conectado al repo de GitHub
- Variables de entorno en Vercel (las mismas del .env.local + NEXT_PUBLIC_BASE_URL=https://prodt.vercel.app)
- Dominio personalizado si está disponible
- Verificar que el cron job funciona en producción (vercel.json)

---

## REGLAS DE DESARROLLO

1. Leer el archivo existente antes de editarlo — nunca sobreescribir sin entender qué hay
2. Usar `serviceSupabase` para todas las operaciones server-side que involucren RLS
3. Cada feature nueva tiene su propio commit descriptivo
4. Los emails se envían SOLO desde server-side (API routes), nunca desde el cliente
5. El feed de noticias se cachea en DB — nunca llamar a las fuentes RSS desde el cliente
6. Las animaciones usan CSS cuando es posible, JS solo cuando es necesario
7. Mobile-first: cada componente nuevo debe verse bien en 375px antes que en desktop
8. NO romper funcionalidades existentes: Gran DT, Prode y Auth ya funcionan

---

## ORDEN DE EJECUCIÓN RECOMENDADO

```
Semana 1  → Prioridad 1 (bugs) + Prioridad 2.1 y 2.2 (rendimiento + forma)
Semana 2  → Prioridad 2.3, 2.4, 2.5 (comparador + más elegidos + noticias)
Semana 3  → Prioridad 2.6, 2.7, 2.8 (planificador + ranking + emails)
Semana 4  → Prioridad 3 (diseño y animaciones) + Prioridad 4 (deploy)
```

---

*ProDT v2.0 · Gran DT y Prode del Mundial 2026 · Sponsor: Lazar — Símbolo de Confianza*
