// generar_hechos.js — Lee desde Supabase y genera prolog/hechos.pl
// Ejecutar: node scripts/generar_hechos.js
// Regenera el archivo hechos.pl con todos los datos actuales de la BD

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function cargarEnv() {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) {
    console.error('❌  No se encontró .env');
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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Escapa strings para Prolog (reemplaza comillas simples)
const escPL = (s) => (s || '').replace(/'/g, "\\'");

async function traerTodo(tabla, campos) {
  const todos = [];
  let pagina = 0;
  const TAM = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tabla)
      .select(campos)
      .range(pagina * TAM, (pagina + 1) * TAM - 1);
    if (error) throw new Error(`Supabase error en ${tabla}: ${error.message}`);
    todos.push(...data);
    if (data.length < TAM) break;
    pagina++;
  }
  return todos;
}

async function main() {
  console.log('🎬  Generando prolog/hechos.pl desde Supabase...\n');

  // ── Descargar datos ──────────────────────────────────────────
  console.log('  Descargando géneros...');
  const generos = await traerTodo('generos', 'id_tmdb, nombre');

  console.log('  Descargando películas...');
  const peliculas = await traerTodo(
    'peliculas',
    'id_tmdb, titulo, anio, rating, tono, duracion_min, idioma_orig'
  );

  console.log('  Descargando relaciones película-género...');
  const relaciones = await traerTodo('pelicula_generos', 'id_pelicula, id_genero');

  console.log(`  ✓ ${generos.length} géneros, ${peliculas.length} películas, ${relaciones.length} relaciones\n`);

  // ── Construir archivo Prolog ─────────────────────────────────
  const lineas = [];
  const fecha = new Date().toLocaleString('es-MX');

  lineas.push(`% ================================================================`);
  lineas.push(`% hechos.pl — AUTO-GENERADO por scripts/generar_hechos.js`);
  lineas.push(`% Generado el: ${fecha}`);
  lineas.push(`% NO editar manualmente. Ejecuta generar_hechos.js para regenerar.`);
  lineas.push(`%`);
  lineas.push(`% ESTRUCTURA DE HECHOS:`);
  lineas.push(`%   genero(IdTmdb, Nombre)`);
  lineas.push(`%   pelicula(IdTmdb, Titulo, Anio, Rating, Tono)`);
  lineas.push(`%   pelicula_detalle(IdTmdb, IdiomaCod, DuracionMin)`);
  lineas.push(`%   pelicula_genero(IdPelicula, IdGenero)`);
  lineas.push(`% ================================================================`);
  lineas.push('');
  lineas.push(':- discontiguous genero/2.');
  lineas.push(':- discontiguous pelicula/5.');
  lineas.push(':- discontiguous pelicula_detalle/3.');
  lineas.push(':- discontiguous pelicula_genero/2.');
  lineas.push('');

  // ── Hechos de géneros ────────────────────────────────────────
  lineas.push(`% ── Géneros (${generos.length} total) ──────────────────────────────────`);
  for (const g of generos) {
    lineas.push(`genero(${g.id_tmdb}, '${escPL(g.nombre)}').`);
  }
  lineas.push('');

  // ── Hechos de películas ──────────────────────────────────────
  lineas.push(`% ── Películas (${peliculas.length} total) ────────────────────────────────`);
  for (const p of peliculas) {
    const anio   = p.anio   ?? 0;
    const rating = p.rating ?? 0.0;
    const tono   = p.tono   ?? 'moderado';
    lineas.push(`pelicula(${p.id_tmdb}, '${escPL(p.titulo)}', ${anio}, ${rating}, ${tono}).`);

    // Detalle solo si tiene al menos uno de los campos
    if (p.idioma_orig || p.duracion_min) {
      const idioma = p.idioma_orig ?? 'en';
      const dur    = p.duracion_min ?? 0;
      lineas.push(`pelicula_detalle(${p.id_tmdb}, ${idioma}, ${dur}).`);
    }
  }
  lineas.push('');

  // ── Hechos de relaciones ─────────────────────────────────────
  lineas.push(`% ── Relaciones película-género (${relaciones.length} total) ────────────`);
  for (const r of relaciones) {
    lineas.push(`pelicula_genero(${r.id_pelicula}, ${r.id_genero}).`);
  }
  lineas.push('');

  // ── Escribir archivo ─────────────────────────────────────────
  const contenido = lineas.join('\n');
  const destino = resolve(ROOT, 'prolog', 'hechos.pl');
  writeFileSync(destino, contenido, 'utf8');

  const kb = Math.round(contenido.length / 1024);
  console.log(`✅  hechos.pl generado: ${destino}`);
  console.log(`    ${peliculas.length} películas, ${generos.length} géneros — ${kb} KB\n`);
  console.log('Siguiente paso: docker-compose up (o swipl prolog/servidor.pl)\n');
}

main().catch((e) => { console.error('\n❌ Error fatal:', e.message); process.exit(1); });
