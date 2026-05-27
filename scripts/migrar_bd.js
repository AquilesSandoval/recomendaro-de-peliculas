#!/usr/bin/env node
// migrar_bd.js — Crea las tablas del proyecto en Supabase (PostgreSQL)
// Ejecutar: node scripts/migrar_bd.js
// Requiere que DATABASE_URL esté en el .env de la raíz del proyecto

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Cargar .env manualmente (evita dependencia de dotenv en scripts simples)
const envPath = resolve(ROOT, '.env');
if (existsSync(envPath)) {
  const lineas = readFileSync(envPath, 'utf8').split('\n');
  for (const linea of lineas) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const [clave, ...resto] = limpia.split('=');
    if (clave && resto.length) process.env[clave.trim()] = resto.join('=').trim();
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  No se encontró DATABASE_URL en el .env');
  console.error('   Ejecuta primero: node scripts/setup.js');
  process.exit(1);
}

// Importación dinámica de pg (se instala con npm install en scripts/)
const require = createRequire(import.meta.url);
let pg;
try {
  pg = require('pg');
} catch {
  console.error('❌  Falta el paquete "pg". Ejecuta: cd scripts && npm install');
  process.exit(1);
}
const { Client } = pg;

// ── SQL de migración ─────────────────────────────────────────────────────────
const SQL_MIGRACION = `
-- ============================================================
-- CineExpert — Migración inicial de base de datos
-- ============================================================

-- Extensión para UUIDs (Supabase ya la tiene, pero no hace daño)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. GÉNEROS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generos (
  id_tmdb  INTEGER PRIMARY KEY,
  nombre   TEXT    NOT NULL
);

-- ── 2. PELÍCULAS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS peliculas (
  id_tmdb         INTEGER     PRIMARY KEY,
  titulo          TEXT        NOT NULL,
  titulo_original TEXT,
  anio            SMALLINT,
  sinopsis        TEXT,
  rating          NUMERIC(3,1),
  poster_url      TEXT,
  duracion_min    SMALLINT,
  tono            TEXT        CHECK (tono IN ('ligero','moderado','serio','oscuro','infantil')),
  popularidad     NUMERIC(10,3),
  idioma_orig     CHAR(2)
);

-- ── 3. RELACIÓN N:M peliculas ↔ generos ─────────────────────
CREATE TABLE IF NOT EXISTS pelicula_generos (
  id_pelicula INTEGER NOT NULL REFERENCES peliculas(id_tmdb) ON DELETE CASCADE,
  id_genero   INTEGER NOT NULL REFERENCES generos(id_tmdb)   ON DELETE CASCADE,
  PRIMARY KEY (id_pelicula, id_genero)
);

-- ── 4. SESIONES DE USUARIO ───────────────────────────────────
CREATE TABLE IF NOT EXISTS sesiones (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
  respuestas      JSONB       NOT NULL DEFAULT '{}',
  recomendaciones JSONB       NOT NULL DEFAULT '[]'
);

-- ── ÍNDICES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pelicula_generos_genero ON pelicula_generos(id_genero);
CREATE INDEX IF NOT EXISTS idx_peliculas_anio          ON peliculas(anio);
CREATE INDEX IF NOT EXISTS idx_peliculas_tono          ON peliculas(tono);
CREATE INDEX IF NOT EXISTS idx_peliculas_rating        ON peliculas(rating);
CREATE INDEX IF NOT EXISTS idx_sesiones_fecha          ON sesiones(fecha DESC);
`;

// ── Ejecución ─────────────────────────────────────────────────────────────────
async function migrar() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Supabase requiere SSL
  });

  try {
    console.log('🔌  Conectando a Supabase...');
    await client.connect();
    console.log('✅  Conexión exitosa\n');

    console.log('📋  Ejecutando migraciones...');
    await client.query(SQL_MIGRACION);

    // Verificar tablas creadas
    const { rows } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('generos','peliculas','pelicula_generos','sesiones')
      ORDER BY table_name;
    `);

    console.log('\n✅  Tablas creadas/verificadas:');
    rows.forEach((r) => console.log(`   ✓ ${r.table_name}`));

    if (rows.length < 4) {
      const encontradas = rows.map((r) => r.table_name);
      const esperadas = ['generos', 'peliculas', 'pelicula_generos', 'sesiones'];
      const faltantes = esperadas.filter((t) => !encontradas.includes(t));
      console.warn(`\n⚠️  Faltan tablas: ${faltantes.join(', ')}`);
    } else {
      console.log('\n🎉  Base de datos lista. Continúa con: node scripts/ingestar_tmdb.js');
    }
  } catch (err) {
    console.error('\n❌  Error durante la migración:');
    console.error(`   ${err.message}`);
    if (err.message.includes('password')) {
      console.error('\n   Verifica que la contraseña en DATABASE_URL sea correcta.');
      console.error('   La encuentras en: Supabase → Project Settings → Database → Database password');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrar();
