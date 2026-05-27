#!/usr/bin/env node
// setup.js — Configura el proyecto: crea el .env y opcionalmente migra la BD
// Ejecutar desde la raíz del proyecto: node scripts/setup.js

import readline from 'readline';
import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const preguntar = (texto) =>
  new Promise((ok) => rl.question(texto, (r) => ok(r.trim())));

const preguntarSecreto = (texto) => {
  process.stdout.write(texto);
  process.stdin.setRawMode?.(true);
  return new Promise((ok) => {
    let valor = '';
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const oyente = (ch) => {
      if (ch === '\n' || ch === '\r') {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('data', oyente);
        process.stdout.write('\n');
        ok(valor);
      } else if (ch === '') {
        process.exit();
      } else if (ch === '') {
        valor = valor.slice(0, -1);
      } else {
        valor += ch;
        process.stdout.write('*');
      }
    };
    process.stdin.on('data', oyente);
  });
};

const linea = () => console.log('─'.repeat(60));

async function main() {
  console.log('\n🎬  CineExpert — Asistente de configuración\n');
  linea();

  // ── Verificar si ya existe .env ──────────────────────────────
  const envPath = resolve(ROOT, '.env');
  if (existsSync(envPath)) {
    const resp = await preguntar('⚠️  Ya existe un archivo .env. ¿Sobreescribir? (s/N): ');
    if (resp.toLowerCase() !== 's') {
      console.log('Cancelado. El .env existente no fue modificado.');
      rl.close(); return;
    }
  }

  console.log('\n📽️  TMDB — The Movie Database');
  console.log('   Obtén tu API key gratuita en: https://www.themoviedb.org/settings/api\n');
  const tmdbKey = await preguntar('   TMDB_API_KEY: ');

  linea();
  console.log('\n🗄️  Supabase');
  console.log('   Encuéntralos en: Supabase Dashboard → Project Settings → API');
  console.log('   y en: Project Settings → Database → Connection string\n');

  const supabaseUrl      = await preguntar('   SUPABASE_URL (ej: https://abc123.supabase.co): ');
  const supabaseAnon     = await preguntar('   SUPABASE_ANON_KEY: ');
  const supabaseService  = await preguntar('   SUPABASE_SERVICE_KEY (service_role): ');

  console.log('\n   DATABASE_URL — la encuentras en:');
  console.log('   Supabase Dashboard → Project Settings → Database → Connection string');
  console.log('   Formato: postgresql://postgres:[TU-PASSWORD]@db.[REF].supabase.co:5432/postgres\n');
  const databaseUrl = await preguntar('   DATABASE_URL: ');

  linea();

  // ── Construir contenido del .env ─────────────────────────────
  const contenido = `# CineExpert — Variables de entorno
# Generado por scripts/setup.js el ${new Date().toLocaleString('es-MX')}

# ── TMDB ────────────────────────────────────────────────────
TMDB_API_KEY=${tmdbKey}
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500

# ── Supabase ─────────────────────────────────────────────────
SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=${supabaseAnon}
SUPABASE_SERVICE_KEY=${supabaseService}
DATABASE_URL=${databaseUrl}

# ── Prolog ───────────────────────────────────────────────────
PROLOG_HOST=localhost
PROLOG_PORT=8081

# ── Node / Express ───────────────────────────────────────────
PORT=3001
NODE_ENV=development

# ── Frontend (Vite) ──────────────────────────────────────────
VITE_API_URL=http://localhost:3001
`;

  writeFileSync(envPath, contenido, 'utf8');
  console.log(`\n✅  Archivo .env creado en: ${envPath}`);

  // ── Preguntar si migrar ahora ─────────────────────────────
  linea();
  const migrar = await preguntar('\n¿Crear las tablas en Supabase ahora? (S/n): ');
  rl.close();

  if (migrar.toLowerCase() !== 'n') {
    console.log('\n🚀  Ejecutando migración...\n');
    const resultado = spawnSync('node', ['scripts/migrar_bd.js'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    if (resultado.status !== 0) {
      console.error('\n❌  La migración falló. Revisa el error arriba.');
      process.exit(1);
    }
  } else {
    console.log('\nPuedes migrar después con: node scripts/migrar_bd.js');
  }

  console.log('\n✨  Configuración completa. Continúa con: node scripts/ingestar_tmdb.js\n');
}

main().catch((err) => { console.error(err); rl.close(); process.exit(1); });
