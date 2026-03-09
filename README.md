# Te Waihora Trail Project

## Overview

Te Waihora Trail is a community project combining a public-facing marketing site, an administrative portal, and a serverless API. The portal lets authorised staff manage trail geometry (GeoJSON), points of interest, volunteer events, newsletter content, and gallery media. The backend is FastAPI hosted on Azure Functions (ASGI) and persists data in a Supabase Postgres instance and Azure Blob/Supabase storage.

## Repository layout

- `frontend/public` – static marketing site (HTML/CSS/JS delivered via CDN or static host)
- `frontend/portal` – React + Vite administrative SPA with an interactive Leaflet map editor
- `api` – Azure Functions app exposing authentication, map management, volunteer, gallery, and contact endpoints
- `database` – SQL migrations and seed scripts for Supabase/Postgres
- `data` – local JSON data files used for volunteer event storage when Supabase is not configured

## Prerequisites

- Node.js 18.17+ (Vite 7 compatibility) and npm 9+
- Python 3.10 (matches `api/runtime.txt`)
- Azure Functions Core Tools v4 for local API hosting (`npm install -g azure-functions-core-tools@4` or via Homebrew)
- PostgreSQL client tools (`psql`) if you plan to apply the SQL scripts locally
- Access to the Supabase project, Admin JWT secret, and storage buckets referenced in `api/local.settings.json`

## Getting started

### 1. Backend API (FastAPI on Azure Functions)

```bash
python3.10 -m venv .venv
source .venv/bin/activate        # On Windows use: .venv\Scripts\activate
pip install -r requirements.txt
cd api
```

1. Copy `local.settings.json` (do not commit secrets) and update every placeholder with your Supabase, database, SMTP, and storage credentials. The file is consumed automatically by Azure Functions when you run locally.

2. Start the functions host:

   ```bash
   func start
   ```

   The API will be available at `http://localhost:7071/api/*`. CORS is preconfigured for `http://localhost:5173`, matching the Vite dev server.

### 2. Admin portal (React + Vite)

```bash
cd frontend/portal
npm install
```

Create `frontend/portal/.env.local` (Vite reads any `.env.*`) with at least:

```
VITE_API_BASE_URL=http://localhost:7071/api
# Optional legacy admin keys if still required by volunteers/gallery pages
# VITE_VOLUNTEER_ADMIN_KEY=...
# VITE_GALLERY_ADMIN_KEY=...
```

Run the development server:

```bash
npm run dev
```

The portal defaults to `http://localhost:5173`. Login and registration talk to the local Azure Functions API.

### 3. Static marketing site

The public site lives in `frontend/public`. During local development you can open `index.html` directly or serve the folder with any static file server. To publish alongside the portal build, run:

```bash
python3 -m http.server
```

from `frontend/portal`; the build output will include the SPA. Serve `frontend/public` separately if you need to mirror the production structure.

## Environment configuration

### Backend (Azure Functions)

- `AzureWebJobsStorage` – required by Azure Functions; use `UseDevelopmentStorage=true` locally.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` – public Supabase project credentials used for public data fetches.
- `SUPABASE_SERVICE_ROLE_KEY` – service key for administrative actions such as gallery uploads.
- `SUPABASE_GALLERY_BUCKET`, `SUPABASE_GALLERY_PATH_PREFIX`, `SUPABASE_GALLERY_PUBLIC` – storage configuration for gallery media.
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE` – Postgres connection.
- `ADMIN_JWT_SECRET`, `ADMIN_JWT_EXP_MINUTES` – JWT signing configuration for authenticated admin sessions.
- `VOLUNTEER_DATA_PATH`, `VOLUNTEER_EVENTS_PATH`, `VOLUNTEER_ADMIN_KEY` – optional file-based storage for volunteer registrations/events if Supabase tables are unavailable.
- `GALLERY_STORAGE_CONN_STRING`, `GALLERY_CONTAINER`, `GALLERY_METADATA_BLOB`, `GALLERY_ADMIN_KEY` – fallback local/Blob storage settings for gallery metadata.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `ADMIN_EMAIL` – contact form notification settings.

All values can live in `api/local.settings.json` for local development; production deployments should use Azure App Settings or a secure secret store.

### Frontend (Vite)

- `VITE_API_BASE_URL` – base URL of the Azure Functions API (`http://localhost:7071/api` locally, production API endpoint otherwise).
- `VITE_VOLUNTEER_ADMIN_KEY`, `VITE_GALLERY_ADMIN_KEY` – legacy support for pages that previously trusted shared secrets. Prefer authenticated flows whenever possible.

## Database and seed data

- `database/te_waihora.sql` – base schema; run once when provisioning a fresh Postgres instance.
- `database/populate.sql` – initial data for statuses, categories, and demo content.
- `database/migration_contact.sql` and `database/migration_icon_path.sql` – schema migrations applied after the base dump.

Apply scripts with `psql` (or Supabase SQL editor):

```bash
psql "$DATABASE_URL" -f database/te_waihora.sql
psql "$DATABASE_URL" -f database/migration_contact.sql
psql "$DATABASE_URL" -f database/migration_icon_path.sql
psql "$DATABASE_URL" -f database/populate.sql
```

## Key capabilities

- **Interactive map editor** – draw and edit trail geometry (GeoJSON), manage status legends, and control POI visibility directly in the portal (`frontend/portal/src/components/InteractiveMapEditor.jsx`).
- **Volunteer management** – review registrations, publish volunteer events with imagery, and export contact details.
- **Gallery & project updates** – upload media to Supabase/Azure storage, manage updates, and surface content on the public site.
- **Newsletter & contact workflows** – list subscribers, respond to contact submissions, and manage statuses.
