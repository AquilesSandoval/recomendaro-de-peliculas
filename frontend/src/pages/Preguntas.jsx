import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import BarraProgreso from '../components/BarraProgreso.jsx';

const TOTAL_PREGUNTAS = 6;

export default function Preguntas() {
  const { sesionId }            = useParams();
  const location                = useLocation();
  const navigate                = useNavigate();
  const [pregunta, setPregunta] = useState(location.state?.pregunta ?? null);
  const [candidatos, setCandidatos] = useState(location.state?.candidatos ?? null);
  const [seleccion, setSeleccion]   = useState([]);
  const [numPregunta, setNumPregunta] = useState(1);
  const [preguntasHechas, setPreguntasHechas] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  // Si no llegamos con estado (recarga de página), volver al inicio
  useEffect(() => {
    if (!pregunta) navigate('/');
  }, [pregunta, navigate]);

  async function enviarRespuesta() {
    if (seleccion.length === 0) return;
    const valor = pregunta.tipo === 'multiple' ? seleccion : seleccion[0];
    setLoading(true);
    setError(null);
    try {
      const nuevasHechas = [...preguntasHechas, pregunta.id];
      const data = await api.responder(sesionId, pregunta.id, valor, nuevasHechas);
      setPreguntasHechas(nuevasHechas);

      if (data.terminado) {
        navigate(`/resultados/${sesionId}`, { state: { recomendaciones: data.recomendaciones, candidatos: data.candidatos } });
      } else {
        setPregunta(data.pregunta);
        setCandidatos(data.candidatos);
        setSeleccion([]);
        setNumPregunta((n) => n + 1);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleOpcion(valor) {
    if (pregunta.tipo === 'multiple') {
      setSeleccion((prev) =>
        prev.includes(valor) ? prev.filter((v) => v !== valor) : [...prev, valor]
      );
    } else {
      setSeleccion([valor]);
    }
  }

  if (!pregunta) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Progreso */}
        <div className="mb-8">
          <BarraProgreso actual={numPregunta} total={TOTAL_PREGUNTAS} candidatos={candidatos} />
        </div>

        {/* Tarjeta de pregunta */}
        <div className="card p-8">
          <p className="text-xs text-violet-400 uppercase tracking-widest mb-3 font-medium">
            {pregunta.tipo === 'multiple' ? 'Selecciona todas las que apliquen' : 'Elige una opción'}
          </p>
          <h2 className="text-2xl font-bold mb-6 leading-snug">{pregunta.texto}</h2>

          {/* Opciones */}
          <div className={`grid gap-2 ${pregunta.tipo === 'multiple' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {pregunta.opciones.map((op) => {
              const activo = seleccion.includes(op.valor);
              return (
                <button
                  key={op.valor}
                  onClick={() => toggleOpcion(op.valor)}
                  className={`text-left px-4 py-3 rounded-xl border transition-all duration-150 text-sm font-medium
                    ${activo
                      ? 'border-violet-500 bg-violet-500/15 text-white'
                      : 'border-cineborder hover:border-gray-600 text-gray-300'}`}
                >
                  <span className="mr-2">{activo ? '✓' : '○'}</span>
                  {op.etiqueta}
                </button>
              );
            })}
          </div>

          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

          {/* Botón continuar */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={enviarRespuesta}
              disabled={seleccion.length === 0 || loading}
              className="btn-primary"
            >
              {loading ? 'Procesando...' : numPregunta === TOTAL_PREGUNTAS ? 'Ver resultados →' : 'Siguiente →'}
            </button>
          </div>
        </div>

        {/* Indicador de progreso circular de candidatos */}
        {candidatos !== null && (
          <p className="text-center text-gray-600 text-xs mt-5">
            La IA está analizando {candidatos} películas para encontrar tu match perfecto
          </p>
        )}
      </div>
    </div>
  );
}
