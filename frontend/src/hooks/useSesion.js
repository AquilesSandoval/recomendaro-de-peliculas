import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export function useSesion() {
  const navigate = useNavigate();
  const [sesionId, setSesionId]             = useState(null);
  const [pregunta, setPregunta]             = useState(null);
  const [candidatos, setCandidatos]         = useState(null);
  const [preguntasHechas, setPreguntasHechas] = useState([]);
  const [recomendaciones, setRecomendaciones] = useState([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);

  const iniciar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.iniciarSesion();
      setSesionId(data.id_sesion);
      setPregunta(data.pregunta);
      setCandidatos(data.candidatos);
      navigate(`/preguntas/${data.id_sesion}`, { state: { pregunta: data.pregunta, candidatos: data.candidatos } });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const responder = useCallback(async (id_sesion, preguntaId, valor) => {
    setLoading(true);
    setError(null);
    try {
      const nuevasHechas = [...preguntasHechas, preguntaId];
      const data = await api.responder(id_sesion, preguntaId, valor, nuevasHechas);
      setPreguntasHechas(nuevasHechas);

      if (data.terminado) {
        setRecomendaciones(data.recomendaciones || []);
        navigate(`/resultados/${id_sesion}`);
      } else {
        setPregunta(data.pregunta);
        setCandidatos(data.candidatos);
      }
      return data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [preguntasHechas, navigate]);

  return { sesionId, pregunta, candidatos, preguntasHechas, recomendaciones, loading, error, iniciar, responder };
}
