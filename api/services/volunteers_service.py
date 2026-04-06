"""Volunteer service operations."""

from __future__ import annotations

from auth import get_current_user
from gallery import store_volunteer_event_image
from volunteers import (
    add_volunteer_entry,
    create_event,
    delete_event,
    list_volunteer_registrations_for_user,
    load_events,
    load_volunteers,
    remove_volunteer_registration,
    update_event,
)

from .errors import AppError


def register_volunteer(payload: dict, request) -> dict:
    current_user, _ = get_current_user(request, require=False)
    try:
        entry = add_volunteer_entry(payload, current_user=current_user)
    except ValueError as exc:
        raise AppError(str(exc), 400) from exc
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    return {"status": "received", "entry": entry}


def list_admin_volunteers() -> list:
    try:
        return load_volunteers()
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc


def list_events() -> list:
    try:
        items = load_events()
    except RuntimeError as exc:
        raise AppError(str(exc), 503) from exc
    items.sort(key=lambda item: item.get("date", ""))
    return items


def list_user_registrations(user: dict) -> list:
    try:
        return list_volunteer_registrations_for_user(
            user.get("id") or "", user.get("email") or ""
        )
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc


def remove_user_registration(registration_id: str, user: dict) -> dict:
    if not registration_id:
        raise AppError("Missing registration id", 400)
    try:
        removed = remove_volunteer_registration(
            registration_id, user.get("id") or "", user.get("email") or ""
        )
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    if not removed:
        raise AppError("Registration not found", 404)
    return {"status": "deleted", "id": registration_id}


def list_admin_events() -> list:
    try:
        items = load_events()
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    items.sort(key=lambda item: item.get("date", ""))
    return items


def create_admin_event(payload: dict) -> dict:
    try:
        event = create_event(payload)
    except ValueError as exc:
        raise AppError(str(exc), 400) from exc
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    return {"event": event}


def upload_admin_event_image(payload: dict) -> dict:
    try:
        asset = store_volunteer_event_image(payload)
    except ValueError as exc:
        raise AppError(str(exc), 400) from exc
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    return {"asset": asset}


def update_admin_event(event_id: str, payload: dict) -> dict:
    if not event_id:
        raise AppError("Missing event id", 400)
    try:
        event = update_event(event_id, payload)
    except ValueError as exc:
        raise AppError(str(exc), 404) from exc
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    return {"event": event}


def delete_admin_event(event_id: str) -> dict:
    if not event_id:
        raise AppError("Missing event id", 400)
    try:
        removed = delete_event(event_id)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    if not removed:
        raise AppError("Event not found", 404)
    return {"status": "deleted", "id": event_id}

