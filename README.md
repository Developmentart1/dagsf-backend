# DAG SF - Backend API

Arquitectura de contenedores para DAG Soluciones Financieras (SOFOM).

## Stack

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Nginx | 80 | Reverse proxy + frontend estático |
| Backend API | 3000 | Node.js / Express |
| PostgreSQL | 5432 | Datos transaccionales |
| Redis | 6379 | Cache, sesiones, pub/sub |
| MinIO | 9000 / 9001 | Archivos, expedientes, contratos |
| Directus | 8055 | Panel admin interno (sobre PostgreSQL) |

## Inicio rápido

```bash
# 1. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus contraseñas

# 2. Levantar todo
docker compose up -d --build

# 3. Ejecutar migraciones (crear tablas)
docker compose exec backend node scripts/migrate.js

# 4. Poblar datos de prueba
docker compose exec backend node scripts/seed.js
```

## Accesos

- **Website**: http://localhost
- **API**: http://localhost/api
- **Health check**: http://localhost/api/health
- **Directus (admin)**: http://localhost:8055
- **MinIO Console**: http://localhost:9001

## Endpoints API principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login de usuarios internos |
| POST | `/api/auth/registro` | Crear usuario (admin) |
| GET | `/api/clientes` | Listar clientes con paginación |
| POST | `/api/clientes` | Crear cliente (PLD/FT) |
| GET | `/api/creditos` | Listar créditos |
| POST | `/api/creditos` | Crear solicitud de crédito |
| PATCH | `/api/creditos/:id/estatus` | Cambiar estatus (workflow) |
| GET | `/api/fideicomisos` | Listar fideicomisos |
| POST | `/api/fideicomisos` | Crear fideicomiso |
| POST | `/api/upload` | Subir archivo a MinIO |
| POST | `/api/leads` | **Publico**: solicitud desde los micrositios (contacto / newsletter) |
| GET | `/api/leads` | Listar solicitudes (interno, requiere token) |
| PATCH | `/api/leads/:id` | Actualizar estado/notas de una solicitud |
| GET | `/api/health` | Estado del backend (via Nginx) |

## Frontend (micrositios)

Los tres micrositios viven en `frontend/` y ya consumen la API:

| Archivo | Descripcion |
|---------|-------------|
| `frontend/index.html` | Hub principal DAG SF |
| `frontend/creditos.html` | Micrositio de creditos |
| `frontend/fideicomisos.html` | Micrositio de fideicomisos |
| `frontend/api.js` | Cliente REST (token en `localStorage`) |
| `frontend/lead-form.js` | Conecta los formularios con `POST /api/leads` |

Nginx sirve `frontend/` en `/` y reenvia `/api/` al backend en el mismo origen, asi que no hay CORS ni URLs absolutas.

## Estructura del backend

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js      # Pool de PostgreSQL
│   │   └── redis.js         # Cliente Redis
│   ├── middleware/
│   │   └── auth.js          # JWT + roles
│   ├── routes/
│   │   ├── auth.js          # Login / registro
│   │   ├── clientes.js      # CRUD clientes
│   │   ├── creditos.js      # Workflow de créditos
│   │   ├── fideicomisos.js  # CRUD fideicomisos
│   │   ├── leads.js         # Solicitudes públicas de los micrositios
│   │   └── upload.js        # Subida a MinIO
│   └── server.js            # Entry point
├── scripts/
│   ├── migrate.js           # Crear tablas
│   └── seed.js              # Datos de prueba
├── Dockerfile
└── package.json
```

## Roles de usuario

- `admin` - Acceso total
- `director` - Reportes y aprobaciones
- `fiduciario` - Operación de fideicomisos
- `ejecutivo` - Atención a clientes y créditos
- `comite` - Solo aprobación de créditos
- `legal` - Contratos y asesoría

## Seguridad incluida

- JWT con expiración de 8 horas
- Rate limiting por IP
- Helmet (headers de seguridad)
- CORS configurado
- Hash de contraseñas con bcrypt (12 rounds)
- Validación de roles por endpoint
- Logs de auditoría en PostgreSQL
