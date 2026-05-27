#!/bin/sh
# Arrancar Prolog en background y Node en foreground
cd /app
swipl prolog/servidor.pl &
echo "Servidor Prolog iniciando en background (PID $!)"
sleep 3
echo "Iniciando servidor Node.js..."
node backend/src/index.js
