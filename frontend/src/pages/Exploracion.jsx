import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

function TarjetaDescartada({ pelicula, sesionId }) {
  const [razones, setRazones]       = useState([]);
  const [expandida, setExpandida]   = useState(false);
  const [loading, setLoading]       = useState(false);

  async function verRazones() {
    if (expandida) { setExpandida(false); return; }
    if (razones.length > 0) { setExpandida(true); return; }
    setLoading(true);
    try {
      const data = await api.porQueNo(pelicula.id_tmdb, sesionId);
      setRazones(data.razones || ['No hay criterios de descarte claros']);
      setExpandida(true);
    } catch { setRazones(['Error al cargar razones']); setExpandida(true); }
    finally { setLoading(false); }
  }

  return (
    <div className="card p-4 flex gap-4 items-start">
      {/* Mini poster */}
      <div className="flex-shrink-0 w-12 h-16 bg-cineborder rounded-lg overflow-hidden">
        {pelicula.poster_url
          ? <img src={pelicula.poster_url} alt={pelicula.titulo} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-lg">🎬</div>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm truncate">{pelicula.titulo}</p>
            <p className="text-gray-500 text-xs">{pelicula.anio} · ⭐ {pelicula.rating}</p>
          </div>
          <button
            onClick={verRazones}
            disabled={loading}
            className="text-red-400 hover:text-red-300 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0"
          >
            {loading ? '...' : expandida ? '▲ Ocultar' : '¿Por qué no?'}
          </button>
        </div>

        {expandida && (
          <ul className="mt-2 space-y-1">
            {razones.map((r, i) => (
              <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                <span className="text-red-500 flex-shrink-0">✗</span>
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Exploracion() {
  const { sesionId } = useParams();
  const navigate     = useNavigate();
  const [peliculas, setPeliculas] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [busqueda, setBusqueda]   = useState('');

  useEffect(() => {
    // Cargar la sesión para saber cuáles son las recomendadas y excluirlas
    fetch(`${import.meta.env.VITE_API_URL ?? ''}/sesion/${sesionId}/resultado`)
      .then((r) => r.json())
      .then((data) => {
        const idsTop = new Set((data.recomendaciones || []).map((r) => r.id_tmdb));
        // Cargar películas populares de Supabase (vía backend)
        return fetch(`${import.meta.env.VITE_API_URL ?? ''}/pelicula/todas`)
          .then((r) => r.ok ? r.json() : { peliculas: [] })
          .then((d) => setPeliculas((d.peliculas || []).filter((p) => !idsTop.has(p.id_tmdb))));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sesionId]);

  const filtradas = peliculas.filter((p) =>
    p.titulo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(`/resultados/${sesionId}`)} className="text-gray-500 hover:text-white text-sm transition-colors">
            ← Volver
          </button>
          <h1 className="text-2xl font-bold">Películas descartadas</h1>
        </div>

        <p className="text-gray-500 text-sm mb-6">
          Haz clic en "¿Por qué no?" para ver qué reglas de Prolog descartaron cada película según tus preferencias.
        </p>

        {/* Buscador */}
        <input
          type="text"
          placeholder="Buscar película..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full bg-cinegray border border-cineborder rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 mb-4 outline-none focus:border-violet-500 transition-colors"
        />

        {loading ? (
          <p className="text-center text-gray-500 py-10">Cargando películas...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-center text-gray-500 py-10">
            {busqueda ? 'No hay resultados para esa búsqueda' : 'No hay películas descartadas'}
          </p>
        ) : (
          <div className="space-y-3">
            {filtradas.slice(0, 100).map((p) => (
              <TarjetaDescartada key={p.id_tmdb} pelicula={p} sesionId={sesionId} />
            ))}
            {filtradas.length > 100 && (
              <p className="text-center text-gray-600 text-sm py-2">
                Mostrando 100 de {filtradas.length} — usa el buscador para filtrar
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
