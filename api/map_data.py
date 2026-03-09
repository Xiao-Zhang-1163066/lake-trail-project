"""Helpers for loading map data from the database."""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from database import db_enabled, db_fetch_all


class MapDataError(RuntimeError):
    """Raised when public map data cannot be loaded."""


def _ensure_db_enabled() -> None:
    if not db_enabled():
        raise MapDataError("Database not configured for map data")


def _load_json(value: Any) -> Any:
    """Try to parse JSON fields returned as strings."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return value


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _as_str(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def fetch_public_trails() -> dict:
    """Return trail segments with legend information."""
    _ensure_db_enabled()

    rows = db_fetch_all(
        """
        SELECT
            t.id,
            t.name,
            t.status,
            t.description,
            t.legend_label,
            t.is_public,
            COALESCE(t.sort_index, 0) AS sort_index,
            t.geojson,
            s.label AS status_label,
            s.line_color,
            s.line_weight,
            s.dash_array
        FROM map_trail_segments AS t
        JOIN map_trail_status_styles AS s ON t.status = s.status
        ORDER BY t.sort_index ASC, t.name ASC
        """
    )

    segments: list[dict[str, Any]] = []
    legend: list[dict[str, Any]] = []

    for row in rows:
        geojson = _load_json(row.get("geojson")) or {}

        segment_id = _as_str(row.get("id"))
        dash_array = row.get("dash_array")
        style = {
            "color": row.get("line_color"),
            "weight": row.get("line_weight"),
        }
        if dash_array:
            style["dashArray"] = dash_array

        segment = {
            "id": segment_id,
            "name": row.get("name"),
            "status": row.get("status"),
            "description": row.get("description"),
            "legendLabel": row.get("legend_label"),
            "statusLabel": row.get("status_label"),
            "style": style,
            "isPublic": row.get("is_public", True),
            "geojson": geojson,
        }

        segments.append(segment)

        if segment["isPublic"]:
            legend.append(
                {
                    "id": segment_id,
                    "label": segment.get("legendLabel") or segment.get("name"),
                    "color": style.get("color"),
                    "dashArray": style.get("dashArray"),
                }
            )

    return {"segments": segments, "legend": legend}


def fetch_public_pois(category: str | None = None) -> dict:
    """Return POI categories and points of interest."""
    _ensure_db_enabled()

    categories = db_fetch_all(
        """
        SELECT
            id,
            icon,
            icon_path,
            label,
            group_name,
            default_visible,
            COALESCE(sort_index, 0) AS sort_index
        FROM map_poi_categories
        ORDER BY sort_index ASC, label ASC
        """
    )

    where_parts: list[str] = []
    params: list[Any] = []
    if category:
        where_parts.append("c.icon = %s")
        params.append(category)

    where_clause = ""
    if where_parts:
        where_clause = "WHERE " + " AND ".join(where_parts)

    pois = db_fetch_all(
        f"""
        SELECT
            p.id,
            c.icon AS category_slug,
            p.name,
            p.description,
            p.lat,
            p.lng,
            p.image_url,
            p.gmaps_url,
            p.is_public,
            COALESCE(p.sort_index, 0) AS sort_index
        FROM map_points_of_interest AS p
        JOIN map_poi_categories AS c ON p.category_id = c.id
        {where_clause}
        ORDER BY sort_index ASC, p.name ASC
        """,
        tuple(params) if params else None,
    )

    formatted_categories = [
        {
            "id": row.get("id"),  # Use actual database ID (integer)
            "slug": row.get("icon"),  # Icon slug for frontend reference
            "label": row.get("label"),
            "icon": row.get("icon"),  # Legacy: keep for backward compatibility
            "iconPath": row.get("icon_path"),  # NEW: SVG file path
            "group": row.get("group_name"),
            "defaultVisible": row.get("default_visible", True),
        }
        for row in categories
    ]

    formatted_pois = [
        {
            "id": _as_str(row.get("id")),
            "category": row.get("category_slug"),
            "name": row.get("name"),
            "description": row.get("description"),
            "lat": _to_float(row.get("lat")),
            "lng": _to_float(row.get("lng")),
            "image": row.get("image_url"),
            "gmaps": row.get("gmaps_url"),
            "isPublic": row.get("is_public", True),
        }
        for row in pois
    ]

    return {"categories": formatted_categories, "pois": formatted_pois}
