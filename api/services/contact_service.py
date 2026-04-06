"""Contact and newsletter service operations."""

from __future__ import annotations

from contact import (
    delete_contact_submission,
    list_contact_submissions,
    list_newsletter_subscribers,
    submit_contact_form,
    subscribe_newsletter,
    unsubscribe_newsletter,
    update_contact_submission_status,
)
from utils import normalize_email

from .errors import AppError


def submit_contact(payload: dict) -> dict:
    name = (payload.get("name") or "").strip()
    email = normalize_email(payload.get("email"))
    message = (payload.get("message") or "").strip()
    if not name:
        raise AppError("Name is required", 400)
    if not email or "@" not in email:
        raise AppError("A valid email is required", 400)
    if not message:
        raise AppError("Message is required", 400)

    try:
        submission = submit_contact_form(name, email, message)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    return {
        "ok": True,
        "message": "Your message has been sent successfully! We'll get back to you soon.",
        "submission": submission,
    }


def subscribe_newsletter_service(payload: dict) -> dict:
    email = normalize_email(payload.get("email"))
    name = (payload.get("name") or "").strip() or None
    if not email or "@" not in email:
        raise AppError("A valid email is required", 400)

    try:
        subscription = subscribe_newsletter(email, name)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    return {
        "ok": True,
        "message": "Successfully subscribed to newsletter!",
        "subscription": subscription,
    }


def unsubscribe_newsletter_service(payload: dict) -> dict:
    email = normalize_email(payload.get("email"))
    if not email or "@" not in email:
        raise AppError("A valid email is required", 400)
    try:
        subscription = unsubscribe_newsletter(email)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc
    return {
        "ok": True,
        "message": "Successfully unsubscribed from newsletter.",
        "subscription": subscription,
    }


def list_admin_submissions(status: str | None = None, limit: int = 50) -> list[dict]:
    try:
        return list_contact_submissions(status=status, limit=limit)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc


def patch_admin_submission(submission_id: str, payload: dict) -> dict:
    if not submission_id:
        raise AppError("Missing submission id", 400)
    status = payload.get("status")
    if not status or status not in ["new", "read", "responded", "archived"]:
        raise AppError("Invalid status value", 400)
    try:
        return update_contact_submission_status(submission_id, status)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc


def delete_admin_submission(submission_id: str) -> dict:
    if not submission_id:
        raise AppError("Missing submission id", 400)
    try:
        delete_contact_submission(submission_id)
    except RuntimeError as exc:
        raise AppError(str(exc), 404) from exc
    return {"message": "Submission deleted successfully"}


def list_admin_subscribers(active: str | None = None, limit: int = 1000) -> list[dict]:
    active_param = (active or "").lower()
    try:
        if active_param == "true":
            return list_newsletter_subscribers(active_only=True, limit=limit)
        if active_param == "false":
            return list_newsletter_subscribers(active_only=False, limit=limit)
        return list_newsletter_subscribers(active_only=None, limit=limit)
    except RuntimeError as exc:
        raise AppError(str(exc), 500) from exc

