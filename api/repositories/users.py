"""User repository functions."""

from __future__ import annotations

from psycopg import errors as psycopg_errors

from utils import format_timestamp, normalize_email

from .core import db_enabled, db_execute, db_fetch_one


def resolve_role(value: str | None) -> str:
    """Resolve and validate user role."""
    role = (value or "").strip().lower()
    if role in {"admin", "volunteer"}:
        return role
    return "volunteer"


def db_row_to_user(row: dict | None) -> dict | None:
    """Convert a database row to a user dict."""
    if not row:
        return None
    raw_id = row.get("id")
    user_id = str(raw_id) if raw_id is not None else None
    return {
        "id": user_id,
        "email": normalize_email(row.get("email")),
        "name": (row.get("name") or "").strip(),
        "passwordHash": row.get("password_hash") or "",
        "role": resolve_role(row.get("role")),
        "createdAt": format_timestamp(row.get("created_at")),
        "updatedAt": format_timestamp(row.get("updated_at")),
    }


def find_user_by_email(email: str) -> dict | None:
    """Find a user by email address."""
    target = normalize_email(email)
    if not target:
        return None
    row = db_fetch_one(
        "SELECT id, email, name, password_hash, role, created_at, updated_at"
        " FROM users WHERE email = %s LIMIT 1",
        (target,),
    )
    return db_row_to_user(row)


def update_user_profile(user_id: str, name: str | None) -> dict | None:
    """Update basic user profile fields."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    try:
        row = db_fetch_one(
            "UPDATE users SET name = %s, updated_at = now() "
            "WHERE id = %s "
            "RETURNING id, email, name, password_hash, role, created_at, updated_at",
            (name or None, user_id),
        )
    except psycopg_errors.UndefinedTable:
        raise RuntimeError("Users table is missing. Check database migrations.") from None
    return db_row_to_user(row)


def update_user_password(user_id: str, password_hash: str) -> bool:
    """Update user's password hash."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    try:
        affected = db_execute(
            "UPDATE users SET password_hash = %s, updated_at = now() WHERE id = %s",
            (password_hash, user_id),
        )
    except psycopg_errors.UndefinedTable:
        raise RuntimeError("Users table is missing. Check database migrations.") from None
    return affected > 0


def find_user_by_id(user_id: str) -> dict | None:
    """Find a user by ID."""
    if not user_id:
        return None
    row = db_fetch_one(
        "SELECT id, email, name, password_hash, role, created_at, updated_at"
        " FROM users WHERE id = %s LIMIT 1",
        (user_id,),
    )
    return db_row_to_user(row)

