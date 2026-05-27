#!/bin/sh
# Script de arranque dentro del contenedor Docker
# Inicia Prolog en background y luego Node.js en foreground
cd /app
swipl prolog/servidor.pl &
echo "🧠 Servidor Prolog iniciando en background (PID $!)"
sleep 3
echo "🎬 Iniciando servidor Node.js..."
node src/index.js
