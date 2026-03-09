"""Map admin routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from gallery import require_admin
from services.errors import AppError
from services.map_admin_service import (
    create_admin_poi,
    create_admin_trail,
    delete_admin_poi,
    delete_admin_trail,
    get_admin_poi,
    get_admin_trail,
    update_admin_poi,
    update_admin_trail,
)

from .common import json_response, parse_json, text_response


router = APIRouter(tags=["map-admin"])


@router.post("/map/admin/pois")
async def map_admin_pois_create(request: Request):
    if not require_admin(request):
        return text_response("Unauthorized", 401)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = create_admin_poi(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result, 201)


@router.get("/map/admin/pois/{poi_id}")
def map_admin_poi_get(poi_id: int, request: Request):
    if not require_admin(request):
        return text_response("Unauthorized", 401)
    try:
        result = get_admin_poi(poi_id)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)


@router.put("/map/admin/pois/{poi_id}")
async def map_admin_poi_update(poi_id: int, request: Request):
    if not require_admin(request):
        return text_response("Unauthorized", 401)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = update_admin_poi(poi_id, payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)


@router.delete("/map/admin/pois/{poi_id}")
def map_admin_poi_delete(poi_id: int, request: Request):
    if not require_admin(request):
        return text_response("Unauthorized", 401)
    try:
        result = delete_admin_poi(poi_id)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)


@router.post("/map/admin/trails")
async def map_admin_trails_create(request: Request):
    if not require_admin(request):
        return text_response("Unauthorized", 401)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = create_admin_trail(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result, 201)


@router.get("/map/admin/trails/{trail_id}")
def map_admin_trail_get(trail_id: int, request: Request):
    if not require_admin(request):
        return text_response("Unauthorized", 401)
    try:
        result = get_admin_trail(trail_id)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)


@router.put("/map/admin/trails/{trail_id}")
async def map_admin_trail_update(trail_id: int, request: Request):
    if not require_admin(request):
        return text_response("Unauthorized", 401)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = update_admin_trail(trail_id, payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)


@router.delete("/map/admin/trails/{trail_id}")
def map_admin_trail_delete(trail_id: int, request: Request):
    if not require_admin(request):
        return text_response("Unauthorized", 401)
    try:
        result = delete_admin_trail(trail_id)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)
