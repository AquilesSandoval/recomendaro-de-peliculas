import { Routes, Route } from 'react-router-dom';
import Inicio from './pages/Inicio.jsx';
import Preguntas from './pages/Preguntas.jsx';
import Resultados from './pages/Resultados.jsx';
import Exploracion from './pages/Exploracion.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/"                       element={<Inicio />} />
      <Route path="/preguntas/:sesionId"    element={<Preguntas />} />
      <Route path="/resultados/:sesionId"   element={<Resultados />} />
      <Route path="/explorar/:sesionId"     element={<Exploracion />} />
    </Routes>
  );
}
