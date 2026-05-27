// Servidor Express — CineExpert Backend
// Arranca el servidor Prolog como proceso hijo y luego levanta Express
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sesionRoutes from './routes/sesion.js';
import peliculaRoutes from './routes/pelicula.js';
import { manejarErrores } from './middleware/errores.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, servicio: 'CineExpert Backend', timestamp: new Date().toISOString() });
});

app.use('/sesion',   sesionRoutes);
app.use('/pelicula', peliculaRoutes);
app.use(manejarErrores);

// Arrancar el servidor Prolog como proceso hijo
function iniciarProlog() {
  const prologPath = resolve(ROOT, 'prolog', 'servidor.pl');
  console.log('🧠 Iniciando servidor Prolog...');

  const proc = spawn('swipl', [prologPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  proc.stdout.on('data', (d) => process.stdout.write(`[prolog] ${d}`));
  proc.stderr.on('data', (d) => process.stderr.write(`[prolog] ${d}`));

  proc.on('close', (code) => {
    if (code !== 0) console.error(`[prolog] proceso terminó con código ${code}`);
  });

  return proc;
}

// Espera hasta que el servidor Prolog responda (máx 30 segundos)
async function esperarProlog(maxMs = 30000) {
  const inicio = Date.now();
  const url = `http://${process.env.PROLOG_HOST || 'localhost'}:${process.env.PROLOG_PORT || 8081}/health`;
  while (Date.now() - inicio < maxMs) {
    try {
      const { default: fetch } = await import('node-fetch');
      const resp = await fetch(url, { timeout: 2000 });
      if (resp.ok) return true;
    } catch { /* aún no listo */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function arrancar() {
  iniciarProlog();
  console.log('⏳ Esperando que Prolog esté listo...');
  const listo = await esperarProlog();
  if (!listo) {
    console.warn('⚠️  Prolog no respondió en 30s — iniciando Express de todas formas');
  } else {
    console.log('✅ Servidor Prolog listo');
  }

  app.listen(PORT, () => {
    console.log(`🎬 CineExpert Backend en http://localhost:${PORT}`);
  });
}

arrancar();
