"""Map admin service operations."""

from __future__ import annotations

from map_admin import (
    MapAdminError,
    create_poi,
    create_trail,
    delete_poi,
    delete_trail,
    get_poi_by_id,
    get_trail_by_id,
    update_poi,
    update_trail,
)

from .errors import AppError


def create_admin_poi(payload: dict) -> dict:
    category_id = payload.get("category_id")
    name = payload.get("name")
    lat = payload.get("lat")
    lng = payload.get("lng")
    if not category_id:
        raise AppError("Missing category_id", 400)
    if not name:
        raise AppError("Missing name", 400)
    if lat is None:
        raise AppError("Missing lat", 400)
    if lng is None:
        raise AppError("Missing lng", 400)
    try:
        category_id = int(category_id)
        lat = float(lat)
        lng = float(lng)
    except (ValueError, TypeError):
        raise AppError("Invalid data types", 400) from None

    try:
        poi = create_poi(
            category_id=category_id,
            name=name,
            lat=lat,
            lng=lng,
            description=payload.get("description"),
            image_url=payload.get("image_url"),
            gmaps_url=payload.get("gmaps_url"),
            is_public=payload.get("is_public", True),
            sort_index=payload.get("sort_index", 0),
        )
        return {"poi": poi}
    except MapAdminError as exc:
        raise AppError(str(exc), 400) from exc
    except Exception as exc:
        raise AppError(f"Internal error: {exc}", 500) from exc


def get_admin_poi(poi_id: int) -> dict:
    try:
        poi = get_poi_by_id(poi_id)
        if not poi:
            raise AppError("POI not found", 404)
        return {"poi": poi}
    except AppError:
        raise
    except Exception as exc:
        raise AppError(f"Internal error: {exc}", 500) from exc


def update_admin_poi(poi_id: int, payload: dict) -> dict:
    kwargs = {}
    if "category_id" in payload:
        try:
            kwargs["category_id"] = int(payload["category_id"])
        except (ValueError, TypeError):
            raise AppError("Invalid category_id", 400) from None
    if "name" in payload:
        kwargs["name"] = payload["name"]
    if "lat" in payload:
        try:
            kwargs["lat"] = float(payload["lat"])
        except (ValueError, TypeError):
            raise AppError("Invalid lat", 400) from None
    if "lng" in payload:
        try:
            kwargs["lng"] = float(payload["lng"])
        except (ValueError, TypeError):
            raise AppError("Invalid lng", 400) from None
    if "description" in payload:
        kwargs["description"] = payload["description"]
    if "image_url" in payload:
        kwargs["image_url"] = payload["image_url"]
    if "gmaps_url" in payload:
        kwargs["gmaps_url"] = payload["gmaps_url"]
    if "is_public" in payload:
        kwargs["is_public"] = bool(payload["is_public"])
    if "sort_index" in payload:
        try:
            kwargs["sort_index"] = int(payload["sort_index"])
        except (ValueError, TypeError):
            raise AppError("Invalid sort_index", 400) from None
    try:
        poi = update_poi(poi_id, **kwargs)
        return {"poi": poi}
    except MapAdminError as exc:
        raise AppError(str(exc), 400) from exc
    except Exception as exc:
        raise AppError(f"Internal error: {exc}", 500) from exc


def delete_admin_poi(poi_id: int) -> dict:
    try:
        return delete_poi(poi_id)
    except MapAdminError as exc:
        raise AppError(str(exc), 404) from exc
    except Exception as exc:
        raise AppError(f"Internal error: {exc}", 500) from exc


def create_admin_trail(payload: dict) -> dict:
    name = payload.get("name")
    geojson = payload.get("geojson")
    if not name:
        raise AppError("Missing name", 400)
    if not geojson:
        raise AppError("Missing geojson", 400)
    status = payload.get("status")
    if not status:
        raise AppError("Missing status", 400)
    try:
        trail = create_trail(
            name=name,
            geojson=geojson,
            status=status,
            description=payload.get("description"),
            is_public=payload.get("is_public", True),
            sort_index=payload.get("sort_index", 0),
        )
        return {"trail": trail}
    except MapAdminError as exc:
        raise AppError(str(exc), 400) from exc
    except Exception as exc:
        raise AppError(f"Internal error: {exc}", 500) from exc


def get_admin_trail(trail_id: int) -> dict:
    try:
        trail = get_trail_by_id(trail_id)
        if not trail:
            raise AppError("Trail not found", 404)
        return {"trail": trail}
    except AppError:
        raise
    except Exception as exc:
        raise AppError(f"Internal error: {exc}", 500) from exc


def update_admin_trail(trail_id: int, payload: dict) -> dict:
    kwargs: dict = {}
    if "name" in payload:
        kwargs["name"] = payload["name"]
    if "status" in payload:
        kwargs["status"] = payload["status"]
    if "description" in payload:
        kwargs["description"] = payload["description"]
    if "is_public" in payload:
        kwargs["is_public"] = bool(payload["is_public"])
    if "sort_index" in payload:
        try:
            kwargs["sort_index"] = int(payload["sort_index"])
        except (ValueError, TypeError):
            raise AppError("Invalid sort_index", 400) from None
    if "geojson" in payload:
        kwargs["geojson"] = payload["geojson"]
    try:
        trail = update_trail(trail_id, **kwargs)
        return {"trail": trail}
    except MapAdminError as exc:
        raise AppError(str(exc), 400) from exc
    except Exception as exc:
        raise AppError(f"Internal error: {exc}", 500) from exc


def delete_admin_trail(trail_id: int) -> dict:
    try:
        return delete_trail(trail_id)
    except MapAdminError as exc:
        raise AppError(str(exc), 404) from exc
    except Exception as exc:
        raise AppError(f"Internal error: {exc}", 500) from exc

