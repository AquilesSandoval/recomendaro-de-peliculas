// Rutas de película — explicación y "¿por qué no?"
import { Router } from 'express';
import * as sb from '../services/supabase.js';
import * as prolog from '../services/prolog.js';

const router = Router();

// GET /pelicula/:id/explicar?sesion_id=...
router.get('/:id/explicar', async (req, res, next) => {
  try {
    const { sesion_id } = req.query;
    const id = parseInt(req.params.id);
    if (!sesion_id) return res.status(400).json({ error: 'Falta sesion_id en query' });

    const sesion = await sb.getSesion(sesion_id);
    const respuestas = Array.isArray(sesion.respuestas) ? sesion.respuestas : [];
    const pelicula = await sb.getPelicula(id);
    const generos = await sb.getGenerosDePelicula(id);

    const { razones } = await prolog.explicar(id, respuestas);

    res.json({ pelicula: { ...pelicula, generos }, razones });
  } catch (e) { next(e); }
});

// GET /pelicula/:id/por-que-no?sesion_id=...
router.get('/:id/por-que-no', async (req, res, next) => {
  try {
    const { sesion_id } = req.query;
    const id = parseInt(req.params.id);
    if (!sesion_id) return res.status(400).json({ error: 'Falta sesion_id en query' });

    const sesion = await sb.getSesion(sesion_id);
    const respuestas = Array.isArray(sesion.respuestas) ? sesion.respuestas : [];
    const pelicula = await sb.getPelicula(id);

    const { razones } = await prolog.porQueNo(id, respuestas);

    res.json({ pelicula, razones });
  } catch (e) { next(e); }
});

// GET /pelicula/todas — lista paginada para la pantalla de exploración
router.get('/todas', async (_req, res, next) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase
      .from('peliculas')
      .select('id_tmdb, titulo, anio, rating, poster_url, tono')
      .order('rating', { ascending: false })
      .limit(500);
    if (error) return next(new Error(error.message));
    res.json({ peliculas: data });
  } catch (e) { next(e); }
});

// GET /pelicula/:id — datos de una película
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const pelicula = await sb.getPelicula(id);
    const generos = await sb.getGenerosDePelicula(id);
    res.json({ ...pelicula, generos });
  } catch (e) { next(e); }
});

export default router;
