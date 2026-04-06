# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Te Waihora Trail is a full-stack admin portal for a New Zealand community trail project. It consists of:

- A **FastAPI backend** deployed on Azure Functions with PostgreSQL (Supabase)
- A **React + Vite admin SPA** (`frontend/portal/`) for staff to manage trails, POIs, volunteers, gallery, and content
- A **static marketing site** (`frontend/public/`) in vanilla HTML/CSS/JS

## Commands

### Backend (FastAPI / Azure Functions)

```bash
# Activate virtual environment (from repo root)
source .venv/bin/activate

# Install dependencies
cd api && pip install -r requirements.txt

# Run locally (http://localhost:7071/api)
cd api && func start
```

### Frontend (React Portal)

```bash
cd frontend/portal
npm install
npm run dev       # Dev server at http://localhost:5173
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Static Marketing Site

```bash
python3 -m http.server -d frontend/public
```

## Architecture

### Backend Layering

The API follows a strict 3-layer architecture (see `api/ARCHITECTURE.md`):

```
api/
├── app/
│   ├── routers/        # HTTP layer — request parsing, auth guards, response shaping
│   ├── services/       # Business logic — orchestrates repositories, raises AppError
│   └── repositories/   # Data access — raw SQL via psycopg3, returns dicts/lists
├── config.py           # All env var loading (Supabase, DB, JWT, storage, SMTP)
├── fastapi_app.py      # FastAPI app instance (imported by function_app.py)
├── function_app.py     # Azure Functions ASGI entrypoint + API prefix stripper
└── app/main.py         # FastAPI app factory — registers all routers
```

Routers must not contain business logic. Services must not write raw SQL. Repositories must not know about HTTP.

Errors are raised as `AppError` (from `services/errors.py`) and caught at the router layer.

### Frontend Architecture

```
frontend/portal/src/
├── pages/              # Page-level components (one per route)
├── components/
│   ├── map-editor/     # Leaflet-based interactive map editor subcomponents
│   └── ...             # Shared UI components
├── contexts/
│   └── AuthContext.jsx # Auth state — JWT token persisted to localStorage under key portal.auth.credentials
├── services/
│   └── mapAdminApi.js  # Typed API client for map admin endpoints
├── hooks/map-editor/   # Custom hooks for map editor state/logic
└── constants/          # POI categories and other static config
```

### Frontend–Backend Connection

- **Local dev**: frontend proxies to `http://localhost:7071/api`; configure via `VITE_API_BASE_URL`
- **Auth**: JWT token sent as `Authorization: Bearer <token>` on all authenticated requests
- **Roles**: `admin` users have full access; `volunteer` users can only access `/activities`

### Database

PostgreSQL via Supabase. Schema and migrations are in `database/`:

- `te_waihora.sql` — base schema (users, trails, POIs, project_updates, categories)
- `migration_contact.sql` — contact submissions table
- `populate.sql` — seed data

Local JSON fallbacks for volunteer data exist at `data/volunteers.json` and `data/volunteer_events.json` if the DB is unavailable.

### Storage

Gallery media supports three backends configured in `api/config.py`: Supabase Storage (primary), Azure Blob Storage, or local filesystem (`frontend/public/gallery-media/`).

## Environment Configuration

Backend secrets live in `api/local.settings.json` (not committed for production). Key variables:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` (Supabase pooler)
- `ADMIN_JWT_SECRET`
- SMTP settings for email notifications

## Key Notes

- The backend was recently pivoted from a different framework to FastAPI (see commit `fefa462`)
- The Vite base path is `/portal/` — account for this in routing and asset paths
- CORS is currently open (`*`) on the backend — intentional for local dev
- No automated tests are configured; testing is manual via the Azure Functions CLI and browser
