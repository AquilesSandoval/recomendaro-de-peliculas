-- ============================================================
-- SCHEMA PARA SUPABASE — CineExpert
-- Pegar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Extensión para UUIDs (ya viene activada en Supabase, pero por si acaso)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 1. GÉNEROS (catálogo de TMDB)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generos (
  id_tmdb  INTEGER PRIMARY KEY,   -- ID original de TMDB
  nombre   TEXT    NOT NULL        -- Ej: "Acción", "Comedia", "Terror"
);

-- ------------------------------------------------------------
-- 2. PELÍCULAS
-- tono: lo derivamos durante la ingesta según géneros y rating
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS peliculas (
  id_tmdb         INTEGER PRIMARY KEY,
  titulo          TEXT        NOT NULL,
  titulo_original TEXT,
  anio            SMALLINT,                     -- año de estreno
  sinopsis        TEXT,
  rating          NUMERIC(3,1),                 -- 0.0 – 10.0
  poster_url      TEXT,                         -- URL completa al poster
  duracion_min    SMALLINT,                     -- duración en minutos
  tono            TEXT CHECK (tono IN (
                    'ligero',    -- comedias, animaciones familiares
                    'moderado',  -- dramas suaves, aventura
                    'serio',     -- dramas intensos, biopics
                    'oscuro',    -- terror, thriller, noir
                    'infantil'   -- animación para niños
                  )),
  popularidad     NUMERIC(10,3),                -- score de popularidad de TMDB
  idioma_orig     CHAR(2)                       -- 'en', 'es', 'ja', etc.
);

-- ------------------------------------------------------------
-- 3. RELACIÓN N:M  películas ↔ géneros
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pelicula_generos (
  id_pelicula INTEGER NOT NULL REFERENCES peliculas(id_tmdb) ON DELETE CASCADE,
  id_genero   INTEGER NOT NULL REFERENCES generos(id_tmdb)   ON DELETE CASCADE,
  PRIMARY KEY (id_pelicula, id_genero)
);

-- ------------------------------------------------------------
-- 4. SESIONES DE USUARIO
-- Cada sesión guarda el historial de preguntas/respuestas y el resultado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesiones (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- JSONB con las respuestas: { "generos": ["Acción"], "tono": "ligero", ... }
  respuestas      JSONB       NOT NULL DEFAULT '{}',
  -- JSONB con el top 5: [{ "id_tmdb": 123, "titulo": "...", "afinidad": 87.5 }, ...]
  recomendaciones JSONB       NOT NULL DEFAULT '[]'
);

-- ------------------------------------------------------------
-- ÍNDICES para acelerar las consultas frecuentes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pelicula_generos_genero   ON pelicula_generos(id_genero);
CREATE INDEX IF NOT EXISTS idx_peliculas_anio            ON peliculas(anio);
CREATE INDEX IF NOT EXISTS idx_peliculas_tono            ON peliculas(tono);
CREATE INDEX IF NOT EXISTS idx_peliculas_rating          ON peliculas(rating);
CREATE INDEX IF NOT EXISTS idx_sesiones_fecha            ON sesiones(fecha DESC);

-- ------------------------------------------------------------
-- Verificación rápida: ver tablas creadas
-- ------------------------------------------------------------
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
