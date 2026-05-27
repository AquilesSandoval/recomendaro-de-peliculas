// Cliente HTTP para comunicarse con el backend Node.js
const BASE = import.meta.env.VITE_API_URL ?? '';

async function apiFetch(ruta, opciones = {}) {
  const resp = await fetch(`${BASE}${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `Error ${resp.status}`);
  return data;
}

export const api = {
  iniciarSesion: () =>
    apiFetch('/sesion/iniciar', { method: 'POST' }),

  responder: (id_sesion, pregunta_id, respuesta, preguntas_hechas) =>
    apiFetch('/sesion/responder', {
      method: 'POST',
      body: JSON.stringify({ id_sesion, pregunta_id, respuesta, preguntas_hechas }),
    }),

  getResultado: (id_sesion) =>
    apiFetch(`/sesion/${id_sesion}/resultado`),

  explicar: (id_pelicula, sesion_id) =>
    apiFetch(`/pelicula/${id_pelicula}/explicar?sesion_id=${sesion_id}`),

  porQueNo: (id_pelicula, sesion_id) =>
    apiFetch(`/pelicula/${id_pelicula}/por-que-no?sesion_id=${sesion_id}`),
};
