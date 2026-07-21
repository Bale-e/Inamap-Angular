# Inamap — Backend Server

Servidor Express que actúa como intermediario entre el frontend Angular e Firebase Admin.

## Requisitos

- Node.js 18+
- `ServiceAccountKey.json` (credenciales de Firebase Admin — **NO incluir en Git**)

## Cómo ejecutar

```bash
cd server
npm install
npm run dev   # desarrollo (nodemon)
npm start     # producción
```

El servidor corre en `http://localhost:3000`.

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/edificios` | Lista todos los edificios |
| GET | `/edificios/:id` | Edificio por ID |
| GET | `/edificios/:id/locaciones` | Locaciones de un edificio |
| GET | `/navigation-paths` | Rutas de navegación |
| GET | `/navigation-paths/piso/:piso` | Rutas por piso |

## Variables de entorno

Crear un archivo `.env` en esta carpeta:

```
PORT=3000
```

Las credenciales de Firebase se leen de `ServiceAccountKey.json`.
