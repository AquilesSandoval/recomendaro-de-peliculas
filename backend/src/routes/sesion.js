// Rutas de sesión — el flujo principal del cuestionario
import { Router } from 'express';
import * as sb from '../services/supabase.js';
import * as prolog from '../services/prolog.js';

const router = Router();

// POST /sesion/iniciar — crea sesión y devuelve la primera pregunta
router.post('/iniciar', async (_req, res, next) => {
  try {
    const idSesion = await sb.crearSesion();
    // Prolog elige la primera pregunta (sin respuestas ni preguntas hechas)
    const resultado = await prolog.siguientePregunta([], []);
    res.json({ id_sesion: idSesion, ...resultado });
  } catch (e) { next(e); }
});

// POST /sesion/responder — registra una respuesta y devuelve la siguiente pregunta
router.post('/responder', async (req, res, next) => {
  try {
    const { id_sesion, pregunta_id, respuesta, preguntas_hechas = [] } = req.body;
    if (!id_sesion || !pregunta_id || respuesta === undefined) {
      return res.status(400).json({ error: 'Faltan campos: id_sesion, pregunta_id, respuesta' });
    }

    // Recuperar sesión actual
    const sesion = await sb.getSesion(id_sesion);
    const respuestasActuales = Array.isArray(sesion.respuestas)
      ? sesion.respuestas
      : [];

    // Agregar la nueva respuesta a la lista
    const nuevasRespuestas = [
      ...respuestasActuales,
      { pregunta: pregunta_id, valor: respuesta },
    ];

    const nuevasHechas = [...preguntas_hechas, pregunta_id];

    // Preguntar a Prolog cuál es la siguiente pregunta
    const resultado = await prolog.siguientePregunta(nuevasRespuestas, nuevasHechas);

    if (resultado.terminado) {
      // Pedir recomendaciones a Prolog
      const { top5, total_candidatos } = await prolog.recomendar(nuevasRespuestas);

      // Enriquecer con datos de Supabase (posters, sinopsis)
      const ids = top5.map((r) => r.id_tmdb);
      const datosBD = await sb.getPeliculas(ids);
      const mapaDB = Object.fromEntries(datosBD.map((p) => [p.id_tmdb, p]));

      const recomendacionesEnriquecidas = top5.map((r) => ({
        ...r,
        ...(mapaDB[r.id_tmdb] || {}),
      }));

      // Guardar en Supabase
      await sb.actualizarSesion(id_sesion, nuevasRespuestas, recomendacionesEnriquecidas);

      return res.json({
        terminado: true,
        candidatos: total_candidatos,
        recomendaciones: recomendacionesEnriquecidas,
      });
    }

    // Guardar respuestas parciales
    await sb.actualizarSesion(id_sesion, nuevasRespuestas);

    res.json({ terminado: false, ...resultado });
  } catch (e) { next(e); }
});

// GET /sesion/:id/resultado — resultado final de una sesión
router.get('/:id/resultado', async (req, res, next) => {
  try {
    const sesion = await sb.getSesion(req.params.id);
    const recs = sesion.recomendaciones || [];

    if (recs.length === 0) {
      return res.status(404).json({ error: 'Esta sesión aún no tiene recomendaciones' });
    }

    // Re-enriquecer por si acaso (posters frescos)
    const ids = recs.map((r) => r.id_tmdb).filter(Boolean);
    if (ids.length > 0) {
      const datosBD = await sb.getPeliculas(ids);
      const mapaDB = Object.fromEntries(datosBD.map((p) => [p.id_tmdb, p]));
      const enriquecidas = recs.map((r) => ({ ...r, ...(mapaDB[r.id_tmdb] || {}) }));
      return res.json({ recomendaciones: enriquecidas });
    }

    res.json({ recomendaciones: recs });
  } catch (e) { next(e); }
});

export default router;
