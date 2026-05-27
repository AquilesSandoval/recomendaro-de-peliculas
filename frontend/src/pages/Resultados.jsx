import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import TarjetaPelicula from '../components/TarjetaPelicula.jsx';

export default function Resultados() {
  const { sesionId }  = useParams();
  const location      = useLocation();
  const navigate      = useNavigate();
  const [recs, setRecs]       = useState(location.state?.recomendaciones ?? []);
  const [candidatos, setCandidatos] = useState(location.state?.candidatos ?? null);
  const [loading, setLoading] = useState(recs.length === 0);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (recs.length === 0) {
      api.getResultado(sesionId)
        .then((data) => { setRecs(data.recomendaciones); setLoading(false); })
        .catch((e) => { setError(e.message); setLoading(false); });
    }
  }, [sesionId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">🎬</div>
        <p className="text-gray-400">Calculando tus recomendaciones...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate('/')} className="btn-ghost">Volver al inicio</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🏆</div>
          <h1 className="text-3xl font-bold mb-2">Tu Top 5 personalizado</h1>
          <p className="text-gray-400">
            {candidatos !== null
              ? `Analizé ${candidatos} películas y estas son las que más se ajustan a ti`
              : 'Las películas que más se ajustan a tus gustos'}
          </p>
        </div>

        {/* Lista de películas */}
        {recs.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-gray-400 text-lg mb-2">No encontré películas que coincidan exactamente</p>
            <p className="text-gray-600 text-sm">Prueba con criterios menos restrictivos</p>
            <button onClick={() => navigate('/')} className="btn-primary mt-6">Intentar de nuevo</button>
          </div>
        ) : (
          <div className="space-y-4">
            {recs.map((peli, i) => (
              <TarjetaPelicula
                key={peli.id_tmdb}
                pelicula={peli}
                sesionId={sesionId}
                posicion={i + 1}
              />
            ))}
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
          <Link to={`/explorar/${sesionId}`} className="btn-ghost text-center">
            🔍 Ver películas descartadas
          </Link>
          <button onClick={() => navigate('/')} className="btn-primary">
            🔄 Nueva búsqueda
          </button>
        </div>
      </div>
    </div>
  );
}
