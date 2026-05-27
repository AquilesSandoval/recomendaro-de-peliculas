import { useState } from 'react';
import { api } from '../lib/api.js';

function colorAfinidad(pct) {
  if (pct >= 85) return 'bg-green-500/20 text-green-400 border-green-700';
  if (pct >= 70) return 'bg-violet-500/20 text-violet-400 border-violet-700';
  if (pct >= 55) return 'bg-yellow-500/20 text-yellow-400 border-yellow-700';
  return 'bg-gray-500/20 text-gray-400 border-gray-600';
}

export default function TarjetaPelicula({ pelicula, sesionId, posicion }) {
  const [expandida, setExpandida] = useState(false);
  const [razones, setRazones]     = useState([]);
  const [loadingExp, setLoadingExp] = useState(false);

  async function toggleExplicacion() {
    if (expandida) { setExpandida(false); return; }
    if (razones.length > 0) { setExpandida(true); return; }
    setLoadingExp(true);
    try {
      const data = await api.explicar(pelicula.id_tmdb, sesionId);
      setRazones(data.razones || []);
      setExpandida(true);
    } catch { setRazones(['No se pudo cargar la explicación']); setExpandida(true); }
    finally { setLoadingExp(false); }
  }

  const afinidad = pelicula.afinidad ?? 0;

  return (
    <div className="card overflow-hidden flex flex-col sm:flex-row gap-0">
      {/* Poster */}
      <div className="relative flex-shrink-0 w-full sm:w-36 h-48 sm:h-auto bg-cineborder">
        {posicion && (
          <div className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-cinedark/80 border border-cineborder flex items-center justify-center text-xs font-bold text-gray-400">
            {posicion}
          </div>
        )}
        {pelicula.poster_url ? (
          <img
            src={pelicula.poster_url}
            alt={pelicula.titulo}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🎬</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 p-5 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="text-lg font-bold leading-tight">{pelicula.titulo}</h3>
            <span className={`badge-afinidad border flex-shrink-0 ${colorAfinidad(afinidad)}`}>
              {afinidad}% match
            </span>
          </div>
          <p className="text-gray-500 text-sm mb-2">
            {pelicula.anio && `${pelicula.anio} · `}
            {pelicula.rating && `⭐ ${pelicula.rating}/10 · `}
            {pelicula.duracion_min && `${pelicula.duracion_min} min`}
          </p>
          {pelicula.sinopsis && (
            <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">{pelicula.sinopsis}</p>
          )}
        </div>

        {/* Botón explicación */}
        <div>
          <button
            onClick={toggleExplicacion}
            disabled={loadingExp}
            className="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
          >
            {loadingExp ? '...' : expandida ? '▲ Ocultar explicación' : '▼ ¿Por qué esta película?'}
          </button>

          {expandida && razones.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {razones.map((r, i) => (
                <li key={i} className="text-sm text-gray-300 flex gap-2">
                  <span className="text-green-400 flex-shrink-0">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
