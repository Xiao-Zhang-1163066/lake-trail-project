"""Public read-only service operations."""

from __future__ import annotations

import requests

from config import SUPABASE_ANON_KEY, SUPABASE_URL
from repositories.updates import get_project_update, list_project_updates
from map_data import MapDataError, fetch_public_pois, fetch_public_trails

from .errors import AppError


def get_health() -> str:
    return "OK"


def get_public_trail_proxy() -> tuple[str, int]:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise AppError("Supabase env not set", 500)
    try:
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/public_trail_sections_view?select=*",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        raise AppError(str(exc), 502) from exc
    return res.text, res.status_code


def get_public_trails() -> dict:
    try:
        return fetch_public_trails()
    except MapDataError as exc:
        raise AppError(str(exc), 503) from exc
    except Exception as exc:
        raise AppError("Failed to load trail data", 503) from exc


def get_public_pois(category: str | None = None) -> dict:
    try:
        return fetch_public_pois(category=category)
    except MapDataError as exc:
        raise AppError(str(exc), 503) from exc
    except Exception as exc:
        raise AppError("Failed to load POI data", 503) from exc


def list_public_updates() -> list[dict]:
    try:
        return list_project_updates(include_unpublished=False)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc


def get_public_update_detail(update_id: str) -> dict:
    if not update_id:
        raise AppError("Missing update id", 400)
    try:
        item = get_project_update(update_id)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    if not item or not item.get("isPublished"):
        raise AppError("Update not found", 404)
    return item
