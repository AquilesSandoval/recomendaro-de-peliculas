# ============================================================
# Dockerfile — CineExpert Backend (Node.js + SWI-Prolog)
# ============================================================
FROM node:20-bookworm-slim

# Instalar SWI-Prolog
RUN apt-get update && apt-get install -y --no-install-recommends \
    swi-prolog \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias Node
COPY backend/package.json ./
RUN npm install --omit=dev

# Copiar código
COPY backend/src ./src
COPY prolog ./prolog
COPY start.sh ./start.sh
RUN chmod +x start.sh

EXPOSE 3001
EXPOSE 8081

CMD ["./start.sh"]
