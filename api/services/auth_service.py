"""Authentication service operations."""

from __future__ import annotations

from auth import create_user, hash_password, issue_token, sanitize_user, verify_password
from repositories.users import find_user_by_email, update_user_password, update_user_profile
from utils import normalize_email

from .errors import AppError


def register_user(payload: dict) -> dict:
    email = normalize_email(payload.get("email"))
    if not email or "@" not in email:
        raise AppError("A valid email is required", 400)
    password = payload.get("password") or ""
    if len(password) < 8:
        raise AppError("Password must be at least 8 characters", 400)
    name = (payload.get("name") or "").strip()

    if find_user_by_email(email):
        raise AppError("Email is already registered", 409)

    try:
        record = create_user(email, password, name)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    except ValueError as exc:
        raise AppError(str(exc), 409) from exc

    if not record:
        raise AppError("Failed to create user", 500)

    try:
        token = issue_token(record)
    except ValueError as exc:
        raise AppError(str(exc), 500) from exc
    return {"user": sanitize_user(record), "token": token}


def login_user(payload: dict) -> dict:
    email = normalize_email(payload.get("email"))
    password = payload.get("password") or ""
    if not email or not password:
        raise AppError("Email and password are required", 400)

    user = find_user_by_email(email)
    if not user or not verify_password(password, user.get("passwordHash", "")):
        raise AppError("Invalid email or password", 401)

    try:
        token = issue_token(user)
    except ValueError as exc:
        raise AppError(str(exc), 500) from exc
    return {"user": sanitize_user(user), "token": token}


def update_profile(user: dict, payload: dict) -> dict:
    name = (payload.get("name") or "").strip()
    try:
        updated = update_user_profile(user.get("id"), name)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    if not updated:
        raise AppError("User not found", 404)
    return sanitize_user(updated)


def change_password(user: dict, payload: dict) -> dict:
    current_password = (payload.get("currentPassword") or "").strip()
    new_password = (payload.get("newPassword") or "").strip()
    if len(new_password) < 8:
        raise AppError("New password must be at least 8 characters", 400)
    if not verify_password(current_password, user.get("passwordHash", "")):
        raise AppError("Current password is incorrect", 400)
    try:
        updated = update_user_password(user.get("id"), hash_password(new_password))
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    if not updated:
        raise AppError("User not found", 404)
    return {"status": "updated"}
