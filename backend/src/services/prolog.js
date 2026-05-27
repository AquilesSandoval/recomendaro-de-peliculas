// Servicio Prolog — hace fetch al servidor HTTP de SWI-Prolog
import fetch from 'node-fetch';

const PROLOG_BASE = `http://${process.env.PROLOG_HOST || 'localhost'}:${process.env.PROLOG_PORT || 8081}`;

async function prologPost(endpoint, body) {
  const resp = await fetch(`${PROLOG_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const texto = await resp.text();
    throw new Error(`Prolog ${endpoint} → ${resp.status}: ${texto}`);
  }
  return resp.json();
}

export async function siguientePregunta(respuestas, preguntasHechas) {
  return prologPost('/siguiente_pregunta', { respuestas, preguntas_hechas: preguntasHechas });
}

export async function recomendar(respuestas) {
  return prologPost('/recomendar', { respuestas });
}

export async function explicar(id_pelicula, respuestas) {
  return prologPost('/explicar', { id_pelicula, respuestas });
}

export async function porQueNo(id_pelicula, respuestas) {
  return prologPost('/por_que_no', { id_pelicula, respuestas });
}

export async function healthProlog() {
  const resp = await fetch(`${PROLOG_BASE}/health`);
  return resp.ok;
}
