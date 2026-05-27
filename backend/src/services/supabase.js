// Servicio de Supabase — acceso a datos enriquecidos (posters, sinopsis)
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Node.js 20 no tiene WebSocket nativo — se lo pasamos manualmente
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { global: { WebSocket: ws } }
);

export async function getPeliculas(ids) {
  const { data, error } = await supabase
    .from('peliculas')
    .select('id_tmdb, titulo, anio, sinopsis, rating, poster_url, duracion_min, tono')
    .in('id_tmdb', ids);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data;
}

export async function getPelicula(id) {
  const { data, error } = await supabase
    .from('peliculas')
    .select('id_tmdb, titulo, anio, sinopsis, rating, poster_url, duracion_min, tono, idioma_orig')
    .eq('id_tmdb', id)
    .single();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data;
}

export async function getGenerosDePelicula(id) {
  const { data, error } = await supabase
    .from('pelicula_generos')
    .select('generos(id_tmdb, nombre)')
    .eq('id_pelicula', id);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data.map((r) => r.generos);
}

export async function crearSesion() {
  const { data, error } = await supabase
    .from('sesiones')
    .insert({ respuestas: [], recomendaciones: [] })
    .select('id')
    .single();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data.id;
}

export async function actualizarSesion(id, respuestas, recomendaciones = null) {
  const cambios = { respuestas };
  if (recomendaciones !== null) cambios.recomendaciones = recomendaciones;
  const { error } = await supabase
    .from('sesiones')
    .update(cambios)
    .eq('id', id);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

export async function getSesion(id) {
  const { data, error } = await supabase
    .from('sesiones')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data;
}
