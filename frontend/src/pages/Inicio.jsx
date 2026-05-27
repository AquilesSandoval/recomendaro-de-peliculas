import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Inicio() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  async function empezar() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.iniciarSesion();
      navigate(`/preguntas/${data.id_sesion}`, {
        state: { pregunta: data.pregunta, candidatos: data.candidatos },
      });
    } catch (e) {
      setError('No se pudo conectar con el servidor. ¿Está corriendo el backend?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Fondo con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-cinedark to-cinedark pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center max-w-2xl">
        {/* Icono */}
        <div className="text-7xl mb-6 select-none">🎬</div>

        {/* Título */}
        <h1 className="text-5xl sm:text-6xl font-bold mb-4">
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            CineExpert
          </span>
        </h1>

        {/* Subtítulo */}
        <p className="text-gray-400 text-lg sm:text-xl mb-2">
          Tu experto cinéfilo personal
        </p>
        <p className="text-gray-500 text-base mb-10 max-w-md mx-auto leading-relaxed">
          Responde unas preguntas y te encuentro la película perfecta para ti. Inteligencia artificial hecha en Prolog.
        </p>

        {/* Features */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {['Preguntas adaptativas', 'Top 5 personalizado', 'Explicación lógica'].map((f) => (
            <span key={f} className="text-xs text-violet-300 border border-violet-700 px-3 py-1.5 rounded-full bg-violet-900/20">
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <button onClick={empezar} disabled={loading} className="btn-primary text-lg px-10 py-4">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Iniciando...
            </span>
          ) : '¡Empezar!'}
        </button>

        <p className="text-gray-600 text-xs mt-8">
          ~500 películas en la base de datos · Powered by TMDB + SWI-Prolog
        </p>
      </div>
    </div>
  );
}
