// Middleware de manejo de errores centralizado
export function manejarErrores(err, _req, res, _next) {
  console.error('Error:', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Error interno del servidor' });
}
