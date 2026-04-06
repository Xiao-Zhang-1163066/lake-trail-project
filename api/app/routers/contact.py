"""Contact and newsletter routes."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request

from auth import get_current_admin
from services.contact_service import (
    delete_admin_submission,
    list_admin_submissions,
    list_admin_subscribers,
    patch_admin_submission,
    submit_contact,
    subscribe_newsletter_service,
    unsubscribe_newsletter_service,
)
from services.errors import AppError

from .common import function_error, json_response, parse_json, text_response


router = APIRouter(tags=["contact"])


@router.post("/contact/submit")
async def contact_submit(request: Request):
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = submit_contact(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result, 201)


@router.post("/newsletter/subscribe")
async def newsletter_subscribe_route(request: Request):
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = subscribe_newsletter_service(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result, 201)


@router.post("/newsletter/unsubscribe")
async def newsletter_unsubscribe_route(request: Request):
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        result = unsubscribe_newsletter_service(payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)


@router.get("/contact/admin/submissions")
def contact_admin_submissions(
    request: Request,
    status: str | None = Query(default=None),
    limit: int = Query(default=50),
):
    _, error = get_current_admin(request, require=True)
    if error:
        return function_error(error)
    try:
        submissions = list_admin_submissions(status=status, limit=limit)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"submissions": submissions})


@router.patch("/contact/admin/submissions/{submission_id}")
async def contact_admin_submission_patch(submission_id: str, request: Request):
    _, error = get_current_admin(request, require=True)
    if error:
        return function_error(error)
    try:
        payload = await parse_json(request)
    except RuntimeError as exc:
        return text_response(str(exc), 400)
    try:
        submission = patch_admin_submission(submission_id, payload)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"submission": submission})


@router.delete("/contact/admin/submissions/{submission_id}")
def contact_admin_submission_delete(submission_id: str, request: Request):
    _, error = get_current_admin(request, require=True)
    if error:
        return function_error(error)
    try:
        result = delete_admin_submission(submission_id)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response(result)


@router.get("/newsletter/admin/subscribers")
def newsletter_admin_subscribers(
    request: Request,
    active: str | None = Query(default=None),
    limit: int = Query(default=1000),
):
    _, error = get_current_admin(request, require=True)
    if error:
        return function_error(error)
    try:
        subscribers = list_admin_subscribers(active=active, limit=limit)
    except AppError as exc:
        return text_response(exc.message, exc.status_code)
    return json_response({"subscribers": subscribers})
