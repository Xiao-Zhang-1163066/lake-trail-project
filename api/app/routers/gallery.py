"""Gallery routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from gallery import require_admin
from services.errors import AppError
from services.gallery_service import (
    create_admin_gallery_item,
    delete_admin_gallery_item,
    list_admin_gallery,
    list_public_gallery,
)

from .common import json_response, parse_json, text_response


router = APIRouter(tags=["gallery"])


@router.get("/gallery/public/list")
def gallery_public_list():
    try:
        items = list_public_gallery()
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"items": items})


@router.post("/gallery/public/upload")
def gallery_public_upload():
    return text_response(
        "Public uploads are disabled. Please contact the site administrators.",
        403,
    )


@router.get("/gallery/admin/list")
def gallery_admin_list(request: Request):
    if not require_admin(request):
        return text_response("Unauthorized", 401)
    try:
        items = list_admin_gallery()
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"items": items})


@router.post("/gallery/admin/upload")
async def gallery_admin_upload(request: Request):
    if not require_admin(request):
        return text_response("Unauthorized", 401)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = create_admin_gallery_item(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result, 201)


@router.delete("/gallery/admin/{item_id}")
def gallery_admin_delete(item_id: str, request: Request):
    if not require_admin(request):
        return text_response("Unauthorized", 401)
    try:
        result = delete_admin_gallery_item(item_id)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)
