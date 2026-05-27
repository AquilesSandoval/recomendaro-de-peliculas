// ingestar_tmdb.js — Descarga ~500 películas de TMDB y las sube a Supabase
// Ejecutar: node scripts/ingestar_tmdb.js
// Es idempotente: usa upsert, puedes correrlo varias veces sin duplicados

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Cargar .env desde la raíz del proyecto
function cargarEnv() {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) {
    console.error('❌  No se encontró .env — copia .env.example a .env y rellena las credenciales');
    process.exit(1);
  }
  const lineas = readFileSync(envPath, 'utf8').split('\n');
  for (const linea of lineas) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const [clave, ...resto] = limpia.split('=');
    if (clave && resto.length) process.env[clave.trim()] = resto.join('=').trim();
  }
}
cargarEnv();

const TMDB_KEY  = process.env.TMDB_API_KEY;
const TMDB_URL  = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const IMG_BASE  = process.env.TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p/w500';

if (!TMDB_KEY) {
  console.error('❌  TMDB_API_KEY vacía en .env');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service key para escritura
);

// Mapeo de género → tono (prioridad: oscuro > serio > ligero > infantil > moderado)
const GENERO_A_TONO = {
  27: 'oscuro',    // Terror
  53: 'oscuro',    // Thriller
  80: 'oscuro',    // Crimen
  9648: 'oscuro',  // Misterio
  18: 'serio',     // Drama
  36: 'serio',     // Historia
  10752: 'serio',  // Guerra
  35: 'ligero',    // Comedia
  10749: 'ligero', // Romance
  16: 'infantil',  // Animación
  10751: 'infantil', // Familia
  12: 'moderado',  // Aventura
  28: 'moderado',  // Acción
  878: 'moderado', // Ciencia Ficción
  14: 'moderado',  // Fantasía
  10402: 'ligero', // Música
  99: 'moderado',  // Documental
};

const PRIORIDAD_TONO = { oscuro: 5, serio: 4, ligero: 3, infantil: 2, moderado: 1 };

function derivarTono(generoIds) {
  let mejorTono = 'moderado';
  let mejorPrioridad = 0;
  for (const id of generoIds) {
    const tono = GENERO_A_TONO[id];
    if (tono && PRIORIDAD_TONO[tono] > mejorPrioridad) {
      mejorTono = tono;
      mejorPrioridad = PRIORIDAD_TONO[tono];
    }
  }
  return mejorTono;
}

async function tmdbFetch(ruta, params = {}) {
  const url = new URL(`${TMDB_URL}${ruta}`);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('language', 'es-MX');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`TMDB error ${resp.status} en ${ruta}`);
  return resp.json();
}

// Espera N ms (para respetar rate limit de TMDB: 40 req / 10 seg)
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('🎬  CineExpert — Ingesta de TMDB\n');

  // ── 1. Obtener géneros ───────────────────────────────────────
  console.log('1/4  Descargando géneros...');
  const { genres } = await tmdbFetch('/genre/movie/list');
  const generosDB = genres.map((g) => ({ id_tmdb: g.id, nombre: g.name }));
  const { error: errGeneros } = await supabase
    .from('generos')
    .upsert(generosDB, { onConflict: 'id_tmdb' });
  if (errGeneros) { console.error('Error insertando géneros:', errGeneros); process.exit(1); }
  console.log(`   ✓ ${generosDB.length} géneros guardados`);

  // ── 2. Obtener lista de películas populares (25 páginas = ~500 films) ──
  console.log('\n2/4  Descargando lista de películas (25 páginas)...');
  const peliculasBasico = [];
  for (let pagina = 1; pagina <= 25; pagina++) {
    const { results } = await tmdbFetch('/movie/popular', { page: pagina });
    peliculasBasico.push(...results);
    process.stdout.write(`\r   Página ${pagina}/25 — ${peliculasBasico.length} películas`);
    await esperar(260); // respetar rate limit
  }
  console.log(`\n   ✓ ${peliculasBasico.length} películas en lista`);

  // ── 3. Obtener detalles (duración + idioma) en lotes de 20 ──
  console.log('\n3/4  Descargando detalles (duración, idioma)...');
  const detalles = new Map(); // id → { duracion_min, idioma_orig }
  const LOTE = 20;
  for (let i = 0; i < peliculasBasico.length; i += LOTE) {
    const lote = peliculasBasico.slice(i, i + LOTE);
    const promesas = lote.map((p) =>
      tmdbFetch(`/movie/${p.id}`).catch(() => null)
    );
    const resultados = await Promise.all(promesas);
    for (const det of resultados) {
      if (det) detalles.set(det.id, { duracion_min: det.runtime || null, idioma_orig: det.original_language || null });
    }
    process.stdout.write(`\r   ${Math.min(i + LOTE, peliculasBasico.length)}/${peliculasBasico.length} detalles`);
    await esperar(500);
  }
  console.log(`\n   ✓ ${detalles.size} detalles obtenidos`);

  // ── 4. Insertar en Supabase ──────────────────────────────────
  console.log('\n4/4  Insertando en Supabase...');
  const peliculasDB = [];
  const relacionesDB = [];

  for (const p of peliculasBasico) {
    if (!p.title || !p.release_date) continue;
    const anio = parseInt(p.release_date?.substring(0, 4)) || null;
    const tono = derivarTono(p.genre_ids || []);
    const det  = detalles.get(p.id) || {};

    peliculasDB.push({
      id_tmdb:         p.id,
      titulo:          p.title,
      titulo_original: p.original_title,
      anio,
      sinopsis:        p.overview || null,
      rating:          p.vote_average || null,
      poster_url:      p.poster_path ? `${IMG_BASE}${p.poster_path}` : null,
      duracion_min:    det.duracion_min || null,
      tono,
      popularidad:     p.popularity || null,
      idioma_orig:     det.idioma_orig || p.original_language || null,
    });

    for (const idGenero of (p.genre_ids || [])) {
      relacionesDB.push({ id_pelicula: p.id, id_genero: idGenero });
    }
  }

  // Insertar películas en lotes de 100
  for (let i = 0; i < peliculasDB.length; i += 100) {
    const lote = peliculasDB.slice(i, i + 100);
    const { error } = await supabase
      .from('peliculas')
      .upsert(lote, { onConflict: 'id_tmdb' });
    if (error) console.warn(`   Advertencia en lote ${i}-${i+100}:`, error.message);
  }
  console.log(`   ✓ ${peliculasDB.length} películas en Supabase`);

  // Insertar relaciones (limpiar primero para que sea idempotente)
  const idsInsertar = peliculasDB.map((p) => p.id_tmdb);
  await supabase.from('pelicula_generos').delete().in('id_pelicula', idsInsertar);

  for (let i = 0; i < relacionesDB.length; i += 500) {
    const lote = relacionesDB.slice(i, i + 500);
    // Filtrar relaciones con géneros que existen
    const idsGeneros = new Set(generosDB.map((g) => g.id_tmdb));
    const loteValido = lote.filter((r) => idsGeneros.has(r.id_genero));
    if (loteValido.length === 0) continue;
    const { error } = await supabase.from('pelicula_generos').insert(loteValido);
    if (error) console.warn(`   Advertencia relaciones:`, error.message);
  }
  console.log(`   ✓ ${relacionesDB.length} relaciones pelicula-género guardadas`);

  console.log('\n✅  Ingesta completa. Ahora ejecuta: node scripts/generar_hechos.js\n');
}

main().catch((e) => { console.error('\n❌ Error fatal:', e.message); process.exit(1); });
