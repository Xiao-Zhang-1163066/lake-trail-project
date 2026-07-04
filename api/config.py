"""Configuration and environment variables."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent

# Volunteer data paths
DEFAULT_VOLUNTEER_DATA = (REPO_ROOT / "data" / "volunteers.json").resolve()
VOLUNTEER_DATA_PATH = Path(
    os.environ.get("VOLUNTEER_DATA_PATH", DEFAULT_VOLUNTEER_DATA)
).resolve()
VOLUNTEER_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
VOLUNTEER_ADMIN_KEY = os.environ.get("VOLUNTEER_ADMIN_KEY", "")

DEFAULT_VOLUNTEER_EVENTS = (REPO_ROOT / "data" / "volunteer_events.json").resolve()
VOLUNTEER_EVENTS_PATH = Path(
    os.environ.get("VOLUNTEER_EVENTS_PATH", DEFAULT_VOLUNTEER_EVENTS)
).resolve()
VOLUNTEER_EVENTS_PATH.parent.mkdir(parents=True, exist_ok=True)

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_GALLERY_BUCKET = os.environ.get("SUPABASE_GALLERY_BUCKET", "").strip()
SUPABASE_GALLERY_PATH_PREFIX = (
    os.environ.get("SUPABASE_GALLERY_PATH_PREFIX", "").strip().strip("/")
)
SUPABASE_GALLERY_PUBLIC = (
    os.environ.get("SUPABASE_GALLERY_PUBLIC", "true").strip().lower() != "false"
)
USE_SUPABASE_GALLERY = bool(
    SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and SUPABASE_GALLERY_BUCKET
)

# CORS configuration
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8080,https://witty-stone-00bf7ab00.7.azurestaticapps.net"
    ).split(",")
    if origin.strip()
]

# Admin JWT configuration
ADMIN_JWT_SECRET = os.environ.get("ADMIN_JWT_SECRET", "").strip()
try:
    ADMIN_JWT_EXP_MINUTES = int(os.environ.get("ADMIN_JWT_EXP_MINUTES", "120"))
except ValueError:
    ADMIN_JWT_EXP_MINUTES = 120
ADMIN_JWT_ALGORITHM = "HS256"

# Database configuration
DB_HOST = os.environ.get("DB_HOST", "").strip()
try:
    DB_PORT = int(os.environ.get("DB_PORT", "5432"))
except ValueError:
    DB_PORT = 5432
DB_USER = os.environ.get("DB_USER", "").strip()
DB_PASSWORD = os.environ.get("DB_PASSWORD", "").strip()
DB_NAME = os.environ.get("DB_NAME", "").strip()
DB_SSLMODE = os.environ.get("DB_SSLMODE", "prefer").strip() or "prefer"
try:
    DB_CONNECT_TIMEOUT = int(os.environ.get("DB_CONNECT_TIMEOUT", "10"))
except ValueError:
    DB_CONNECT_TIMEOUT = 10

# Gallery configuration
DEFAULT_LOCAL_GALLERY_DIR = (
    REPO_ROOT / "frontend" / "public" / "gallery-media"
).resolve()
GALLERY_CONN = os.environ.get("GALLERY_STORAGE_CONN_STRING", "").strip()
USE_LOCAL_GALLERY = (
    not USE_SUPABASE_GALLERY
    and ((GALLERY_CONN.lower() == "localfilesystem") or not GALLERY_CONN)
)
GALLERY_CONTAINER = os.environ.get("GALLERY_CONTAINER", "gallery-media")
GALLERY_METADATA_BLOB = os.environ.get("GALLERY_METADATA_BLOB", "metadata.json")
GALLERY_ADMIN_KEY = os.environ.get("GALLERY_ADMIN_KEY", "")

# SMTP configuration for contact form notifications
SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
try:
    SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
except ValueError:
    SMTP_PORT = 587
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").strip()
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").strip()

