"""Volunteer routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from auth import get_current_user
from services.errors import AppError
from services.volunteers_service import (
    create_admin_event,
    delete_admin_event,
    list_admin_events,
    list_admin_volunteers,
    list_events,
    list_user_registrations,
    register_volunteer,
    remove_user_registration,
    update_admin_event,
    upload_admin_event_image,
)
from volunteers import (
    authorize_admin,
)

from .common import function_error, json_response, parse_json, text_response


router = APIRouter(tags=["volunteers"])


@router.post("/volunteers/register")
async def volunteers_register(request: Request):
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = register_volunteer(payload, request)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result, 201)


@router.get("/volunteers/admin/list")
def volunteers_admin_list(request: Request):
    auth = authorize_admin(request)
    if auth:
        return function_error(auth)
    try:
        items = list_admin_volunteers()
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"items": items})


@router.get("/volunteers/events")
def volunteers_events():
    try:
        items = list_events()
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"items": items})


@router.get("/volunteers/me/registrations")
def volunteers_my_registrations(request: Request):
    user, error = get_current_user(request, require=True)
    if error:
        return function_error(error)
    try:
        items = list_user_registrations(user)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"items": items})


@router.delete("/volunteers/me/registrations/{registration_id}")
def volunteers_my_registration_detail(registration_id: str, request: Request):
    user, error = get_current_user(request, require=True)
    if error:
        return function_error(error)
    try:
        result = remove_user_registration(registration_id, user)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)


@router.get("/volunteers/admin/events")
def volunteers_admin_events_list(request: Request):
    auth = authorize_admin(request)
    if auth:
        return function_error(auth)
    try:
        items = list_admin_events()
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"items": items})


@router.post("/volunteers/admin/events")
async def volunteers_admin_events_create(request: Request):
    auth = authorize_admin(request)
    if auth:
        return function_error(auth)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = create_admin_event(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result, 201)


@router.post("/volunteers/admin/events/upload-image")
async def volunteers_admin_events_upload_image(request: Request):
    auth = authorize_admin(request)
    if auth:
        return function_error(auth)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = upload_admin_event_image(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result, 201)


@router.put("/volunteers/admin/events/{event_id}")
async def volunteers_admin_event_update(event_id: str, request: Request):
    auth = authorize_admin(request)
    if auth:
        return function_error(auth)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = update_admin_event(event_id, payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)


@router.delete("/volunteers/admin/events/{event_id}")
def volunteers_admin_event_delete(event_id: str, request: Request):
    auth = authorize_admin(request)
    if auth:
        return function_error(auth)
    try:
        result = delete_admin_event(event_id)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)
