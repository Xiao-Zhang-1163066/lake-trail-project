"""Shared database connection and low-level query helpers."""

from __future__ import annotations

import psycopg
from psycopg.rows import dict_row

from config import (
    DB_CONNECT_TIMEOUT,
    DB_HOST,
    DB_NAME,
    DB_PASSWORD,
    DB_PORT,
    DB_SSLMODE,
    DB_USER,
)


def db_enabled() -> bool:
    """Check if database is configured."""
    return bool(DB_HOST and DB_USER and DB_NAME)


def get_db_connection():
    """Get a new database connection."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    conn = psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD or None,
        dbname=DB_NAME,
        connect_timeout=DB_CONNECT_TIMEOUT,
        sslmode=DB_SSLMODE,
        row_factory=dict_row,
    )
    conn.autocommit = True
    return conn


def db_fetch_one(query: str, params: tuple | list | None = None) -> dict | None:
    """Execute a query and return a single row."""
    if not db_enabled():
        return None
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params or ())
            return cursor.fetchone()


def db_fetch_all(query: str, params: tuple | list | None = None) -> list[dict]:
    """Execute a query and return all rows."""
    if not db_enabled():
        return []
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params or ())
            return list(cursor.fetchall())


def db_execute(query: str, params: tuple | list | None = None) -> int:
    """Execute a query and return the number of affected rows."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params or ())
            return cursor.rowcount

