"""Public read-only routes."""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse, Response

from services.errors import AppError
from services.public_service import (
    get_health,
    get_public_pois,
    get_public_trail_proxy,
    get_public_trails,
    get_public_update_detail,
    list_public_updates,
)

from .common import json_response, text_response


router = APIRouter(tags=["public"])


@router.get("/health")
def health() -> PlainTextResponse:
    return PlainTextResponse(get_health(), status_code=200)


@router.get("/public/trail")
def public_trail():
    try:
        body, status = get_public_trail_proxy()
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return Response(content=body, status_code=status, media_type="application/json")


@router.get("/public/trails")
def public_trails():
    try:
        payload = get_public_trails()
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(payload)


@router.get("/public/pois")
def public_pois(cat: str | None = Query(default=None)):
    category = (cat or "").strip() or None
    try:
        payload = get_public_pois(category=category)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(payload)


@router.get("/public/updates")
def updates_public_list():
    try:
        items = list_public_updates()
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"items": items})


@router.get("/public/updates/{update_id}")
def updates_public_detail(update_id: str):
    try:
        item = get_public_update_detail(update_id)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"item": item})
