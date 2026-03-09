"""Admin functions for managing map POIs and trails."""

from __future__ import annotations

import json
from typing import Any
from repositories.core import db_enabled, db_fetch_one, db_execute, get_db_connection


class MapAdminError(RuntimeError):
    """Raised when map admin operation fails."""


def _ensure_db_enabled() -> None:
    if not db_enabled():
        raise MapAdminError("Database not configured for map admin")


def create_poi(
    category_id: int,
    name: str,
    lat: float,
    lng: float,
    description: str | None = None,
    image_url: str | None = None,
    gmaps_url: str | None = None,
    is_public: bool = True,
    sort_index: int = 0,
) -> dict:
    """
    Create a new POI and return it.
    
    Args:
        category_id: The ID of the POI category
        name: The name/title of the POI
        lat: Latitude
        lng: Longitude
        description: Optional description
        image_url: Optional image URL
        gmaps_url: Optional Google Maps URL
        is_public: Whether the POI is visible to public
        sort_index: Sort order
    
    Returns:
        The created POI as a dict
    
    Raises:
        MapAdminError: If database is not configured or operation fails
    """
    _ensure_db_enabled()
    
    # Validate category exists
    category = db_fetch_one(
        "SELECT id, icon FROM map_poi_categories WHERE id = %s",
        (category_id,)
    )
    if not category:
        raise MapAdminError(f"Category with ID {category_id} not found")
    
    # Insert the POI
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO map_points_of_interest (
                    category_id, name, description, lat, lng,
                    image_url, gmaps_url, is_public, sort_index
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, category_id, name, description, lat, lng,
                          image_url, gmaps_url, is_public, sort_index
                """,
                (
                    category_id,
                    name,
                    description,
                    lat,
                    lng,
                    image_url,
                    gmaps_url,
                    is_public,
                    sort_index,
                ),
            )
            row = cursor.fetchone()
    
    if not row:
        raise MapAdminError("Failed to create POI")
    
    return {
        "id": str(row["id"]),
        "category_id": row["category_id"],
        "category": category["icon"],
        "name": row["name"],
        "description": row["description"],
        "lat": float(row["lat"]),
        "lng": float(row["lng"]),
        "image": row["image_url"],
        "gmaps": row["gmaps_url"],
        "isPublic": row["is_public"],
        "sortIndex": row["sort_index"],
    }


TRAIL_STATUS_ALIASES: dict[str, str] = {
    "stage-1": "stage-1",
    "stage 1": "stage-1",
    "stage_1": "stage-1",
    "stage1": "stage-1",
    "stage-2": "stage-2",
    "stage 2": "stage-2",
    "stage_2": "stage-2",
    "stage2": "stage-2",
    "existing": "existing",
    "existing trail": "existing",
    "existing-trail": "existing",
    "existing_trail": "existing",
}


def _normalize_trail_status(value: str | None) -> str:
    status_key = (value or "").strip().lower()
    normalized = TRAIL_STATUS_ALIASES.get(status_key)
    if not normalized:
        raise MapAdminError(f"Invalid trail status: {value!r}")
    return normalized


def _fetch_status_style(status: str) -> dict:
    style_row = db_fetch_one(
        """
        SELECT status, label, line_color, line_weight, dash_array
        FROM map_trail_status_styles
        WHERE status = %s
        """,
        (status,),
    )
    if not style_row:
        raise MapAdminError(f"Style configuration for status {status!r} not found")
    return style_row


def _format_trail_record(row: dict, status_style: dict | None = None) -> dict:
    """Normalize a raw trail row (and style) into the API-friendly shape."""
    if row is None:
        raise MapAdminError("Trail data is missing")

    status = row["status"]
    style_info = status_style or _fetch_status_style(status)

    raw_geojson = row.get("geojson")
    if isinstance(raw_geojson, str):
        try:
            geojson = json.loads(raw_geojson)
        except ValueError:
            geojson = {}
    else:
        geojson = raw_geojson

    style = {
        "color": style_info["line_color"],
        "weight": style_info["line_weight"],
    }
    if style_info.get("dash_array"):
        style["dashArray"] = style_info["dash_array"]

    return {
        "id": str(row["id"]),
        "name": row["name"],
        "status": status,
        "description": row.get("description"),
        "legendLabel": row.get("legend_label"),
        "isPublic": row.get("is_public", True),
        "sortIndex": row.get("sort_index", 0),
        "style": style,
        "statusLabel": style_info["label"],
        "geojson": geojson or {},
    }


def create_trail(
    name: str,
    geojson: dict,
    status: str,
    description: str | None = None,
    legend_label: str | None = None,
    is_public: bool = True,
    sort_index: int = 0,
) -> dict:
    """
    Create a new trail segment and return it.
    
    Args:
        name: The name of the trail segment
        geojson: The GeoJSON data for the trail path
        status: Trail status (stage-1, stage-2, existing)
        description: Optional description
        legend_label: Optional label for map legend
        is_public: Whether the trail is visible to public
        sort_index: Sort order
    
    Returns:
        The created trail as a dict
    
    Raises:
        MapAdminError: If database is not configured or operation fails
    """
    _ensure_db_enabled()
    
    normalized_status = _normalize_trail_status(status)
    status_style = _fetch_status_style(normalized_status)

    # Convert dicts to JSON strings for PostgreSQL JSONB
    geojson_str = json.dumps(geojson) if isinstance(geojson, dict) else geojson
    
    # Insert the trail
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO map_trail_segments (
                    name, status, description, legend_label, is_public, sort_index,
                    geojson
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
                RETURNING id, name, status, description, legend_label, is_public,
                          sort_index, geojson
                """,
                (
                    name,
                    normalized_status,
                    description,
                    legend_label,
                    is_public,
                    sort_index,
                    geojson_str,
                ),
            )
            row = cursor.fetchone()
    
    if not row:
        raise MapAdminError("Failed to create trail")
    
    return _format_trail_record(row, status_style)


def update_trail(
    trail_id: int,
    *,
    name: str | None = None,
    status: str | None = None,
    description: str | None = None,
    legend_label: str | None = None,
    is_public: bool | None = None,
    sort_index: int | None = None,
    geojson: dict | list | str | None = None,
) -> dict:
    """Update an existing trail segment."""
    _ensure_db_enabled()

    existing = db_fetch_one(
        "SELECT id FROM map_trail_segments WHERE id = %s",
        (trail_id,),
    )
    if not existing:
        raise MapAdminError(f"Trail with ID {trail_id} not found")

    updates: list[str] = []
    params: list[Any] = []
    status_style: dict | None = None

    if name is not None:
        updates.append("name = %s")
        params.append(name)

    if status is not None:
        normalized_status = _normalize_trail_status(status)
        updates.append("status = %s")
        params.append(normalized_status)
        status_style = _fetch_status_style(normalized_status)

    if description is not None:
        updates.append("description = %s")
        params.append(description)

    if legend_label is not None:
        updates.append("legend_label = %s")
        params.append(legend_label)

    if is_public is not None:
        updates.append("is_public = %s")
        params.append(is_public)

    if sort_index is not None:
        updates.append("sort_index = %s")
        params.append(sort_index)

    if geojson is not None:
        geojson_str = (
            json.dumps(geojson)
            if isinstance(geojson, (dict, list))
            else geojson
        )
        updates.append("geojson = %s::jsonb")
        params.append(geojson_str)

    if not updates:
        raise MapAdminError("No fields to update")

    params.append(trail_id)

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                UPDATE map_trail_segments
                SET {", ".join(updates)}
                WHERE id = %s
                RETURNING id, name, status, description, legend_label, is_public,
                          sort_index, geojson
                """,
                tuple(params),
            )
            row = cursor.fetchone()

    if not row:
        raise MapAdminError("Failed to update trail")

    if status_style is None:
        status_style = _fetch_status_style(row["status"])

    return _format_trail_record(row, status_style)


def delete_trail(trail_id: int) -> dict:
    """Delete a trail segment."""
    _ensure_db_enabled()

    existing = db_fetch_one(
        "SELECT id, name FROM map_trail_segments WHERE id = %s",
        (trail_id,),
    )
    if not existing:
        raise MapAdminError(f"Trail with ID {trail_id} not found")

    affected = db_execute(
        "DELETE FROM map_trail_segments WHERE id = %s",
        (trail_id,),
    )

    if affected == 0:
        raise MapAdminError("Failed to delete trail")

    return {
        "success": True,
        "message": f"Trail '{existing['name']}' deleted successfully",
        "id": str(trail_id),
    }


def get_trail_by_id(trail_id: int) -> dict | None:
    """Return a single trail segment by ID."""
    _ensure_db_enabled()

    row = db_fetch_one(
        """
        SELECT
            id,
            name,
            status,
            description,
            legend_label,
            is_public,
            sort_index,
            geojson
        FROM map_trail_segments
        WHERE id = %s
        """,
        (trail_id,),
    )

    if not row:
        return None

    return _format_trail_record(row)


def update_poi(
    poi_id: int,
    category_id: int | None = None,
    name: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    description: str | None = None,
    image_url: str | None = None,
    gmaps_url: str | None = None,
    is_public: bool | None = None,
    sort_index: int | None = None,
) -> dict:
    """
    Update an existing POI and return it.
    
    Args:
        poi_id: The ID of the POI to update
        category_id: Optional new category ID
        name: Optional new name
        lat: Optional new latitude
        lng: Optional new longitude
        description: Optional new description
        image_url: Optional new image URL
        gmaps_url: Optional new Google Maps URL
        is_public: Optional new visibility
        sort_index: Optional new sort index
    
    Returns:
        The updated POI as a dict
    
    Raises:
        MapAdminError: If POI not found or operation fails
    """
    _ensure_db_enabled()
    
    # Check if POI exists
    existing = db_fetch_one(
        "SELECT id FROM map_points_of_interest WHERE id = %s",
        (poi_id,)
    )
    if not existing:
        raise MapAdminError(f"POI with ID {poi_id} not found")
    
    # Build dynamic update query
    updates = []
    params = []
    
    if category_id is not None:
        # Validate category exists
        category = db_fetch_one(
            "SELECT id FROM map_poi_categories WHERE id = %s",
            (category_id,)
        )
        if not category:
            raise MapAdminError(f"Category with ID {category_id} not found")
        updates.append("category_id = %s")
        params.append(category_id)
    
    if name is not None:
        updates.append("name = %s")
        params.append(name)
    
    if lat is not None:
        updates.append("lat = %s")
        params.append(lat)
    
    if lng is not None:
        updates.append("lng = %s")
        params.append(lng)
    
    if description is not None:
        updates.append("description = %s")
        params.append(description)
    
    if image_url is not None:
        updates.append("image_url = %s")
        params.append(image_url)
    
    if gmaps_url is not None:
        updates.append("gmaps_url = %s")
        params.append(gmaps_url)
    
    if is_public is not None:
        updates.append("is_public = %s")
        params.append(is_public)
    
    if sort_index is not None:
        updates.append("sort_index = %s")
        params.append(sort_index)
    
    if not updates:
        raise MapAdminError("No fields to update")
    
    params.append(poi_id)
    
    # Execute update
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                UPDATE map_points_of_interest
                SET {", ".join(updates)}
                WHERE id = %s
                RETURNING id, category_id, name, description, lat, lng,
                          image_url, gmaps_url, is_public, sort_index
                """,
                tuple(params),
            )
            row = cursor.fetchone()
    
    if not row:
        raise MapAdminError("Failed to update POI")
    
    # Get category info
    category = db_fetch_one(
        "SELECT icon FROM map_poi_categories WHERE id = %s",
        (row["category_id"],)
    )
    
    return {
        "id": str(row["id"]),
        "category_id": row["category_id"],
        "category": category["icon"] if category else None,
        "name": row["name"],
        "description": row["description"],
        "lat": float(row["lat"]),
        "lng": float(row["lng"]),
        "image": row["image_url"],
        "gmaps": row["gmaps_url"],
        "isPublic": row["is_public"],
        "sortIndex": row["sort_index"],
    }


def delete_poi(poi_id: int) -> dict:
    """
    Delete a POI.
    
    Args:
        poi_id: The ID of the POI to delete
    
    Returns:
        Dict with success message
    
    Raises:
        MapAdminError: If POI not found or operation fails
    """
    _ensure_db_enabled()
    
    # Check if POI exists
    existing = db_fetch_one(
        "SELECT id, name FROM map_points_of_interest WHERE id = %s",
        (poi_id,)
    )
    if not existing:
        raise MapAdminError(f"POI with ID {poi_id} not found")
    
    # Delete the POI
    affected = db_execute(
        "DELETE FROM map_points_of_interest WHERE id = %s",
        (poi_id,)
    )
    
    if affected == 0:
        raise MapAdminError("Failed to delete POI")
    
    return {
        "success": True,
        "message": f"POI '{existing['name']}' deleted successfully",
        "id": str(poi_id),
    }


def get_poi_by_id(poi_id: int) -> dict | None:
    """
    Get a single POI by ID.
    
    Args:
        poi_id: The ID of the POI
    
    Returns:
        The POI as a dict, or None if not found
    """
    _ensure_db_enabled()
    
    row = db_fetch_one(
        """
        SELECT
            p.id,
            p.category_id,
            c.icon AS category,
            p.name,
            p.description,
            p.lat,
            p.lng,
            p.image_url,
            p.gmaps_url,
            p.is_public,
            p.sort_index
        FROM map_points_of_interest AS p
        JOIN map_poi_categories AS c ON p.category_id = c.id
        WHERE p.id = %s
        """,
        (poi_id,)
    )
    
    if not row:
        return None
    
    return {
        "id": str(row["id"]),
        "category_id": row["category_id"],
        "category": row["category"],
        "name": row["name"],
        "description": row["description"],
        "lat": float(row["lat"]),
        "lng": float(row["lng"]),
        "image": row["image_url"],
        "gmaps": row["gmaps_url"],
        "isPublic": row["is_public"],
        "sortIndex": row["sort_index"],
    }
