"""Project updates service operations."""

from __future__ import annotations

from repositories.updates import (
    create_project_update,
    delete_project_update,
    list_project_updates,
    update_project_update,
)
from gallery import store_project_update_image

from .errors import AppError


def list_admin_updates() -> list[dict]:
    try:
        return list_project_updates(include_unpublished=True)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc


def create_admin_update(payload: dict) -> dict:
    title = (payload.get("title") or "").strip()
    if not title:
        raise AppError("Title is required", 400)
    try:
        return create_project_update(
            title=title,
            summary=(payload.get("summary") or "").strip(),
            detail=(payload.get("detail") or "").strip(),
            category=(payload.get("category") or "").strip(),
            image_url=(payload.get("imageUrl") or "").strip(),
            link_url=(payload.get("linkUrl") or "").strip(),
            is_published=_parse_bool(payload.get("isPublished"), default=True),
        )
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc


def upload_admin_update_image(payload: dict) -> dict:
    try:
        return store_project_update_image(payload)
    except ValueError as exc:
        raise AppError(str(exc), 400) from exc
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc


def update_admin_update(update_id: str, payload: dict) -> dict:
    if not update_id:
        raise AppError("Missing update id", 400)
    kwargs = {}
    if "title" in payload:
        kwargs["title"] = (payload.get("title") or "").strip()
    if "summary" in payload:
        kwargs["summary"] = (payload.get("summary") or "").strip()
    if "detail" in payload:
        kwargs["detail"] = (payload.get("detail") or "").strip()
    if "category" in payload:
        kwargs["category"] = (payload.get("category") or "").strip()
    if "imageUrl" in payload:
        kwargs["image_url"] = (payload.get("imageUrl") or "").strip()
    if "linkUrl" in payload:
        value = (payload.get("linkUrl") or "").strip()
        kwargs["link_url"] = value or None
    if "isPublished" in payload:
        kwargs["is_published"] = _parse_bool(payload.get("isPublished"))

    try:
        item = update_project_update(update_id, **kwargs)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    if not item:
        raise AppError("Update not found", 404)
    return item


def delete_admin_update(update_id: str) -> dict:
    if not update_id:
        raise AppError("Missing update id", 400)
    try:
        removed = delete_project_update(update_id)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    if not removed:
        raise AppError("Update not found", 404)
    return {"status": "deleted", "id": update_id}


def _parse_bool(value, default=None):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "on"}:
            return True
        if lowered in {"false", "0", "no", "off"}:
            return False
    return bool(value)
