"""Authentication routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from auth import get_current_user, sanitize_user
from services.auth_service import change_password, login_user, register_user, update_profile
from services.errors import AppError

from .common import json_response, parse_json, text_response, function_error


router = APIRouter(tags=["auth"])


@router.post("/auth/register")
async def auth_register(request: Request):
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = register_user(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result, 201)


@router.post("/auth/login")
async def auth_login(request: Request):
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = login_user(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)


@router.get("/auth/me")
def auth_me(request: Request):
    user, error = get_current_user(request, require=True)
    if error:
        return function_error(error)
    return json_response({"user": sanitize_user(user)})


@router.put("/auth/profile")
async def auth_profile_update(request: Request):
    user, error = get_current_user(request, require=True)
    if error:
        return function_error(error)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        safe_user = update_profile(user, payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"user": safe_user})


@router.put("/auth/password")
async def auth_change_password(request: Request):
    user, error = get_current_user(request, require=True)
    if error:
        return function_error(error)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = change_password(user, payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)
