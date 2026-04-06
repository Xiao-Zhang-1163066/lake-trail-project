-- PostgreSQL schema for Te Waihora Trail project.
-- Run this script against a Postgres database (e.g. `psql -f data/te_waihora.sql`).

-- Optional: create the database manually before running this file
--   CREATE DATABASE te_waihora ENCODING 'UTF8';
--   \c te_waihora

BEGIN;

-- UUID helper (needed for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User accounts --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id                BIGSERIAL PRIMARY KEY,
    email             VARCHAR(191) NOT NULL UNIQUE,
    name              VARCHAR(191),
    password_hash     VARCHAR(255) NOT NULL,
    role              TEXT NOT NULL DEFAULT 'volunteer'
                        CHECK (role IN ('admin', 'volunteer')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project updates ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS project_updates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title             TEXT NOT NULL,
    summary           TEXT,
    detail            TEXT,
    category          TEXT,
    image_url         TEXT,
    link_url          TEXT,
    is_published      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_updates_published
  ON project_updates (is_published, COALESCE(published_at, created_at) DESC);

-- Public map data ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS map_trail_segments (
    id                BIGSERIAL PRIMARY KEY,
    name              TEXT NOT NULL,
    status            TEXT NOT NULL,
    description       TEXT,
    is_public         BOOLEAN NOT NULL DEFAULT TRUE,
    sort_index        INTEGER NOT NULL DEFAULT 0,
    geojson           JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS map_poi_categories (
    id                BIGSERIAL PRIMARY KEY,
    label             TEXT NOT NULL,
    icon              TEXT,
    icon_path         TEXT DEFAULT '/assets/icons/categories/default.svg',
    group_name        TEXT,
    default_visible   BOOLEAN NOT NULL DEFAULT TRUE,  
    sort_index        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS map_points_of_interest (
    id                BIGSERIAL PRIMARY KEY,
    category_id       BIGINT NOT NULL REFERENCES map_poi_categories(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    description       TEXT,
    lat               NUMERIC(10, 6),
    lng               NUMERIC(10, 6),
    image_url         TEXT,
    gmaps_url         TEXT,
    is_public         BOOLEAN NOT NULL DEFAULT TRUE,
    sort_index        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_map_poi_category ON map_points_of_interest (category_id);
CREATE INDEX IF NOT EXISTS idx_map_poi_visibility ON map_points_of_interest (is_public);

-- Volunteer registrations & events ------------------------------------------

CREATE TABLE IF NOT EXISTS volunteer_registrations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT,
    email             TEXT NOT NULL,
    phone             TEXT,
    interest          TEXT,
    availability      TEXT,
    notes             TEXT,
    event_id          UUID,
    event_title       TEXT,
    user_id           BIGINT REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_registrations_email
  ON volunteer_registrations (lower(email));

CREATE INDEX IF NOT EXISTS idx_volunteer_registrations_user
  ON volunteer_registrations (user_id);

CREATE TABLE IF NOT EXISTS volunteer_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title             TEXT NOT NULL,
    date              DATE NOT NULL,
    description       TEXT,
    link_text         TEXT,
    link_url          TEXT,
    image_url         TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_volunteer_events_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_volunteer_events_updated_at ON volunteer_events;
CREATE TRIGGER trg_volunteer_events_updated_at
BEFORE UPDATE ON volunteer_events
FOR EACH ROW EXECUTE FUNCTION set_volunteer_events_updated_at();

COMMIT;
