// Servidor Express — CineExpert Backend
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import sesionRoutes   from './routes/sesion.js';
import peliculaRoutes from './routes/pelicula.js';
import { manejarErrores } from './middleware/errores.js';

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

// Espera hasta que el servidor Prolog responda (max 60s)
// NOTA: Prolog ya fue iniciado por start.sh — aqui solo esperamos
async function esperarProlog(maxMs = 60000) {
  const inicio = Date.now();
  const url = `http://${process.env.PROLOG_HOST || 'localhost'}:${process.env.PROLOG_PORT || 8081}/health`;
  console.log(`⏳ Esperando servidor Prolog en ${url}...`);

  while (Date.now() - inicio < maxMs) {
    try {
      // Usar fetch nativo de Node 22 (sin timeout option que no soporta node-fetch v3)
      const resp = await fetch(url);
      if (resp.ok) return true;
    } catch {
      // Prolog todavia no esta listo, reintentamos
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function arrancar() {
  const listo = await esperarProlog();

  if (!listo) {
    console.warn('⚠️  Prolog no respondio en 60s — arrancando Express de todas formas');
  } else {
    console.log('✅ Servidor Prolog detectado y listo');
  }

  app.listen(PORT, () => {
    console.log(`🎬 CineExpert Backend en http://localhost:${PORT}`);
  });
}

arrancar();
