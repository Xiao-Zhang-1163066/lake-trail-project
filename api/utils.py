"""Common utilities and helper functions."""

import json
from datetime import datetime, timezone
import azure.functions as func


# Prefer custom headers before the generic Authorization header so that the
# platform-provided auth token (e.g. Static Web Apps) does not override the
# portal's JWT.
TOKEN_HEADER_NAMES = ["X-Portal-Authorization", "X-Auth-Token", "Authorization"]


def cors_headers(extra: dict | None = None) -> dict:
    """Generate CORS headers for responses."""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key, Authorization, X-Portal-Authorization, X-Auth-Token",
    }
    if extra:
        headers.update(extra)
    return headers


def json_response(
    body: dict | list, status: int = 200, headers: dict | None = None
) -> func.HttpResponse:
    """Create a JSON HTTP response."""
    payload = json.dumps(body, ensure_ascii=False)
    return func.HttpResponse(
        payload,
        status_code=status,
        mimetype="application/json",
        headers=cors_headers(headers),
    )


def text_response(message: str, status: int) -> func.HttpResponse:
    """Create a text HTTP response."""
    return func.HttpResponse(message, status_code=status, headers=cors_headers())


def format_timestamp(value):
    """Format a datetime value to ISO 8601 string."""
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        else:
            value = value.astimezone(timezone.utc)
        return value.isoformat().replace("+00:00", "Z")
    return str(value)


def utc_now_naive() -> datetime:
    """Get current UTC time as naive datetime."""
    return datetime.now(timezone.utc)


def normalize_email(value: str) -> str:
    """Normalize email address to lowercase."""
    return (value or "").strip().lower()


def extract_bearer_token(req: func.HttpRequest) -> str:
    """Extract bearer token from request headers."""
    for header_name in TOKEN_HEADER_NAMES:
        raw = req.headers.get(header_name)
        if not raw:
            continue
        value = raw.strip()
        if not value:
            continue
        if value.lower().startswith("bearer "):
            return value[7:].strip()
        # Allow raw tokens in custom headers to avoid format mismatch.
        if header_name != "Authorization":
            return value
    return ""
