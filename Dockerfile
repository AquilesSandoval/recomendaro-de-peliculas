FROM node:22-bookworm-slim

# Instalar SWI-Prolog
RUN apt-get update && apt-get install -y --no-install-recommends \
    swi-prolog \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias Node (preservando la carpeta backend/ para que los paths queden igual que en dev)
COPY backend/package.json ./backend/
RUN cd backend && npm install --omit=dev

# Copiar código preservando la estructura de carpetas
COPY backend/src ./backend/src
COPY prolog ./prolog
COPY start.sh ./start.sh
RUN chmod +x start.sh

EXPOSE 3001
EXPOSE 8081

CMD ["./start.sh"]
