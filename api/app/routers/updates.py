"""Project updates admin routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from auth import get_current_admin
from services.errors import AppError
from services.updates_service import (
    create_admin_update,
    delete_admin_update,
    list_admin_updates,
    update_admin_update,
    upload_admin_update_image,
)

from .common import function_error, json_response, parse_json, text_response


router = APIRouter(tags=["updates"])


@router.get("/updates/admin")
def updates_admin_list(request: Request):
    _, error = get_current_admin(request, require=True)
    if error:
        return function_error(error)
    try:
        items = list_admin_updates()
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"items": items})


@router.post("/updates/admin")
async def updates_admin_create(request: Request):
    _, error = get_current_admin(request, require=True)
    if error:
        return function_error(error)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        item = create_admin_update(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"item": item}, 201)


@router.post("/updates/admin/upload-image")
async def updates_admin_upload_image(request: Request):
    _, error = get_current_admin(request, require=True)
    if error:
        return function_error(error)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        asset = upload_admin_update_image(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"asset": asset}, 201)


@router.put("/updates/admin/{update_id}")
async def updates_admin_update(update_id: str, request: Request):
    _, error = get_current_admin(request, require=True)
    if error:
        return function_error(error)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        item = update_admin_update(update_id, payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"item": item})


@router.delete("/updates/admin/{update_id}")
def updates_admin_delete(update_id: str, request: Request):
    _, error = get_current_admin(request, require=True)
    if error:
        return function_error(error)
    try:
        payload = delete_admin_update(update_id)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(payload)
