"""Gallery service operations."""

from __future__ import annotations

from gallery import add_gallery_entry, delete_gallery_entry, gallery_list

from .errors import AppError


def list_public_gallery() -> list:
    try:
        return gallery_list(include_unapproved=True)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc


def list_admin_gallery() -> list:
    try:
        return gallery_list(include_unapproved=True)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc


def create_admin_gallery_item(payload: dict) -> dict:
    try:
        entry = add_gallery_entry(payload, source="admin")
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    except ValueError as exc:
        raise AppError(str(exc), 400) from exc
    return {"item": entry}


def delete_admin_gallery_item(item_id: str) -> dict:
    if not item_id:
        raise AppError("Missing item id", 400)
    try:
        removed = delete_gallery_entry(item_id)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    if not removed:
        raise AppError("Item not found", 404)
    return {"status": "deleted", "id": item_id}

