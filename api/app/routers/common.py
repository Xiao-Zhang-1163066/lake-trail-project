"""Shared helpers for FastAPI route modules."""

from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse, PlainTextResponse


def text_response(message: str, status: int) -> PlainTextResponse:
    return PlainTextResponse(message, status_code=status)


def json_response(body: dict | list, status: int = 200) -> JSONResponse:
    return JSONResponse(content=body, status_code=status)


def function_error(error) -> PlainTextResponse:
    body = error.get_body()
    message = body.decode("utf-8") if isinstance(body, (bytes, bytearray)) else str(body)
    return text_response(message, getattr(error, "status_code", 500) or 500)


async def parse_json(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except ValueError:
        raise RuntimeError("Invalid JSON payload") from None
    if not isinstance(payload, dict):
        raise RuntimeError("Invalid JSON payload")
    return payload


def parse_bool(value, default=None):
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

