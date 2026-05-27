# 🎬 CineExpert — Recomendador Inteligente de Películas

> Proyecto final — Lenguajes y Autómatas II / Programación Lógica  
> TecNM Campus Morelia — 8vo Semestre ISC

---

## ¿Qué hace?

Sistema experto de recomendación de películas estilo **Akinator cinéfilo**:

1. Te hace preguntas adaptativas sobre tus gustos (Prolog decide la siguiente pregunta para descartar el mayor número de opciones)
2. Al final te entrega un **Top 5 personalizado** con % de afinidad
3. Cada recomendación incluye una **explicación lógica** ("Te recomiendo *Interestelar* porque: prefieres Sci-Fi + te gustan los 2000s + tono serio")
4. Modo **"¿Por qué no esta?"**: ve qué reglas descartaron cualquier película

---

## Arquitectura

```
TMDB API → Supabase (PostgreSQL) → Nube (Railway) → SWI-Prolog → Node.js → React
```

| Componente | Tecnología | Rol |
|---|---|---|
| Datos | TMDB API | ~500 películas con géneros, ratings, posters |
| Base de datos | Supabase (PostgreSQL) | Almacén persistente |
| Lógica | SWI-Prolog | Árbol de decisión, scoring, explicaciones |
| Puente | Node.js + Express | Orquesta Prolog + Supabase + Frontend |
| Interfaz | React + Vite + Tailwind | UI moderna en paleta oscura |
| Deployment | Railway + Vercel | Backend y frontend en la nube |

---

## Cómo correr local

### Requisitos previos
- Node.js 20+
- Docker Desktop
- SWI-Prolog (para desarrollo sin Docker)

### 1. Setup automático (crea .env + tablas en Supabase)

```bash
cd scripts
npm install
npm run setup
# El script te pregunta las credenciales, crea el .env
# y opcionalmente crea las tablas en Supabase al instante
```

> Si prefieres hacerlo por separado:
> ```bash
> npm run setup     # solo crea el .env
> npm run migrar    # crea las tablas en Supabase
> ```

### 2. Ingestar datos de TMDB

```bash
npm run ingestar        # Descarga ~500 películas y las guarda en Supabase
npm run generar-hechos  # Genera prolog/hechos.pl desde la BD
```

### 4. Levantar con Docker

```bash
docker-compose up
# Backend: http://localhost:3001
# Frontend (modo dev): docker-compose --profile dev up
```

### 5. Sin Docker (desarrollo)

```bash
# Terminal 1 — Backend Node
cd backend && npm install && npm run dev

# Terminal 2 — Servidor Prolog
swipl prolog/servidor.pl

# Terminal 3 — Frontend
cd frontend && npm install && npm run dev
```

---

## Estructura del proyecto

```
PROYECTO FINAL/
├── backend/            # Node.js + Express (puente)
│   └── src/
│       ├── routes/     # Endpoints de la API
│       ├── services/   # Lógica de negocio (Supabase, Prolog)
│       └── middleware/
├── prolog/             # Lógica SWI-Prolog
│   ├── hechos.pl       # Auto-generado: hechos de películas y géneros
│   ├── arbol_preguntas.pl  # Árbol de decisión adaptativo
│   ├── recomendador.pl     # Scoring, top 5, explicaciones
│   └── servidor.pl         # Servidor HTTP de Prolog
├── frontend/           # React + Vite + Tailwind
│   └── src/
│       ├── pages/      # Inicio, Preguntas, Resultados, Exploración
│       ├── components/ # Componentes reutilizables
│       └── hooks/      # Custom hooks (useSession, etc.)
├── scripts/            # Ingesta TMDB → Supabase + generación de hechos.pl
├── sql/
│   └── schema.sql      # Schema listo para Supabase
├── Dockerfile          # Node + SWI-Prolog en una sola imagen
├── docker-compose.yml
└── .env.example        # Plantilla de variables de entorno
```

---

## Cómo obtener las credenciales

### API Key de TMDB (gratis)

1. Crea cuenta en [themoviedb.org](https://www.themoviedb.org)
2. Ve a **Configuración → API → Solicitar API Key**
3. Elige "Desarrollador" y llena el formulario (es gratis)
4. Copia la **API Key (v3 auth)** y pégala en `.env` como `TMDB_API_KEY`

### Supabase

1. Crea cuenta en [supabase.com](https://supabase.com)
2. Crea un **New Project** (el free tier permite hasta 500 MB)
3. Ve a **Project Settings → API**:
   - Copia **Project URL** → `SUPABASE_URL`
   - Copia **anon public** → `SUPABASE_ANON_KEY`
   - Copia **service_role** → `SUPABASE_SERVICE_KEY` (solo para scripts de ingesta)

### SWI-Prolog (instalación local)

- **Windows**: Descarga el instalador desde [swi-prolog.org/Download.html](https://www.swi-prolog.org/Download.html)
- **macOS**: `brew install swi-prolog`
- **Linux (Debian/Ubuntu)**: `sudo apt install swi-prolog`

Verifica la instalación: `swipl --version`

---

## Deployment en la nube

### Backend → Railway

```bash
# Instalar CLI de Railway
npm install -g @railway/cli

# Login y deploy
railway login
railway init
railway up
```

### Frontend → Vercel

```bash
cd frontend
vercel deploy
```

---

## Conceptos de Programación Lógica (para el profe)

El código Prolog en `prolog/` demuestra explícitamente:

- **Listas**: `findall/3`, `member/2`, `append/3`, intersecciones de géneros preferidos
- **Recursividad**: cálculo acumulativo de puntajes, recorrido de candidatos
- **Árboles**: árbol de decisión como términos Prolog `nodo(Pregunta, RamaSi, RamaNo)`
- **Hechos**: `pelicula/5`, `pelicula_genero/2`, `genero/2`, `prefiere_genero/2`
- **Reglas**: encadenamiento hacia atrás para inferir recomendaciones
- **Negación por fallo**: `\+` para la función "¿Por qué no esta película?"
