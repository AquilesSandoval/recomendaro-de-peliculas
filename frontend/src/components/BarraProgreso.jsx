export default function BarraProgreso({ actual, total, candidatos }) {
  const porcentaje = total > 0 ? Math.round((actual / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2 text-sm">
        <span className="text-gray-400">
          Pregunta {actual} de {total}
        </span>
        {candidatos !== null && (
          <span className="text-violet-400 font-medium">
            🎬 {candidatos} películas compatibles
          </span>
        )}
      </div>
      <div className="w-full h-1.5 bg-cineborder rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full transition-all duration-500"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}
