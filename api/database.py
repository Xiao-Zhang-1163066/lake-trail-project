"""Database connection and operations."""

from datetime import datetime, timezone, date
import psycopg
from psycopg import errors as psycopg_errors
from psycopg.rows import dict_row

from config import (
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
    DB_SSLMODE,
    DB_CONNECT_TIMEOUT,
)
from utils import format_timestamp, normalize_email


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


def resolve_role(value: str | None) -> str:
    """Resolve and validate user role."""
    role = (value or "").strip().lower()
    if role in {"admin", "volunteer"}:
        return role
    return "admin"


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


# Project updates -------------------------------------------------------------


def db_row_to_update(row: dict | None) -> dict | None:
    """Convert a database row to a project update dict."""
    if not row:
        return None
    return {
        "id": str(row.get("id")),
        "title": (row.get("title") or "").strip(),
        "summary": (row.get("summary") or "").strip(),
        "detail": (row.get("detail") or "").strip(),
        "category": (row.get("category") or "").strip(),
        "imageUrl": (row.get("image_url") or "").strip(),
        "linkUrl": (row.get("link_url") or "").strip(),
        "isPublished": bool(row.get("is_published", True)),
        "createdAt": format_timestamp(row.get("created_at")),
        "updatedAt": format_timestamp(row.get("updated_at")),
        "publishedAt": format_timestamp(row.get("published_at")),
    }


def list_project_updates(include_unpublished: bool = False) -> list[dict]:
    """Return project updates sorted by published/created date."""
    if not db_enabled():
        return []

    where_clause = ""
    params: tuple = ()
    if not include_unpublished:
        where_clause = "WHERE is_published IS TRUE"

    query = (
        "SELECT id, title, summary, detail, category, image_url, link_url, "
        " is_published, created_at, updated_at, published_at"
        " FROM project_updates "
        f"{where_clause} "
        " ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC"
    )
    try:
        rows = db_fetch_all(query, params)
    except psycopg_errors.UndefinedTable:
        # Table not created yet; surface as empty list so public site keeps working.
        return []
    except psycopg_errors.UndefinedColumn:
        fallback_query = (
            "SELECT id, title, summary, NULL AS detail, category, image_url, link_url, "
            " is_published, created_at, updated_at, published_at"
            " FROM project_updates "
            f"{where_clause} "
            " ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC"
        )
        rows = db_fetch_all(fallback_query, params)
    return [db_row_to_update(row) for row in rows if row]


def create_project_update(
    title: str,
    summary: str,
    detail: str,
    category: str,
    image_url: str,
    link_url: str,
    is_published: bool = True,
) -> dict:
    """Create a new project update record."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    query = (
        "INSERT INTO project_updates "
        "(title, summary, detail, category, image_url, link_url, is_published, published_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, CASE WHEN %s THEN now() AT TIME ZONE 'utc' ELSE NULL END) "
        "RETURNING id, title, summary, detail, category, image_url, link_url, "
        "is_published, created_at, updated_at, published_at"
    )
    params = (
        title.strip(),
        summary.strip(),
        detail.strip() or None,
        category.strip(),
        image_url.strip() or None,
        link_url.strip() or None,
        is_published,
        is_published,
    )
    try:
        row = db_fetch_one(query, params)
    except psycopg_errors.UndefinedTable as exc:
        raise RuntimeError(
            "Project updates table is missing. Run the migration in the setup guide."
        ) from exc
    except psycopg_errors.UndefinedColumn:
        fallback_query = (
            "INSERT INTO project_updates "
            "(title, summary, category, image_url, link_url, is_published, published_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, CASE WHEN %s THEN now() AT TIME ZONE 'utc' ELSE NULL END) "
            "RETURNING id, title, summary, NULL AS detail, category, image_url, link_url, "
            "is_published, created_at, updated_at, published_at"
        )
        fallback_params = params[:2] + params[3:]
        row = db_fetch_one(fallback_query, fallback_params)
    return db_row_to_update(row)


def update_project_update(
    update_id: str,
    *,
    title: str | None = None,
    summary: str | None = None,
    detail: str | None = None,
    category: str | None = None,
    image_url: str | None = None,
    link_url: str | None = None,
    is_published: bool | None = None,
) -> dict | None:
    """Update a project update record."""
    if not db_enabled():
        raise RuntimeError("User database not configured")

    assignments: list[tuple[str, object | None, bool]] = []
    if title is not None:
        assignments.append(("title = %s", title.strip(), True))
    if summary is not None:
        assignments.append(("summary = %s", summary.strip(), True))
    if detail is not None:
        assignments.append(("detail = %s", detail.strip() or None, True))
    if category is not None:
        assignments.append(("category = %s", category.strip(), True))
    if image_url is not None:
        assignments.append(("image_url = %s", image_url.strip() or None, True))
    if link_url is not None:
        assignments.append(("link_url = %s", link_url.strip() or None, True))
    if is_published is not None:
        assignments.append(("is_published = %s", is_published, True))
        if is_published:
            assignments.append(
                ("published_at = COALESCE(published_at, now() AT TIME ZONE 'utc')", None, False)
            )
        else:
            assignments.append(("published_at = NULL", None, False))

    if not assignments:
        return get_project_update(update_id)

    fields = [expr for expr, _, __ in assignments]
    params = [value for _, value, uses_placeholder in assignments if uses_placeholder]
    params.append(update_id)

    query = (
        "UPDATE project_updates SET "
        + ", ".join(fields)
        + " , updated_at = now() AT TIME ZONE 'utc'"
        + " WHERE id = %s"
        + " RETURNING id, title, summary, category, image_url, link_url, "
        "is_published, created_at, updated_at, published_at"
    )
    try:
        row = db_fetch_one(query, tuple(params))
    except psycopg_errors.UndefinedTable as exc:
        raise RuntimeError(
            "Project updates table is missing. Run the migration in the setup guide."
        ) from exc
    except psycopg_errors.UndefinedColumn:
        # Remove detail assignment for legacy schema and retry.
        legacy_assignments = [
            (expr, value, uses_placeholder)
            for expr, value, uses_placeholder in assignments
            if not expr.startswith("detail =")
        ]
        if not legacy_assignments:
            return get_project_update(update_id)
        legacy_fields = [expr for expr, _, __ in legacy_assignments]
        legacy_params = [
            value for _, value, uses_placeholder in legacy_assignments if uses_placeholder
        ]
        legacy_params.append(update_id)
        fallback_query = (
            "UPDATE project_updates SET "
            + ", ".join(legacy_fields)
            + " , updated_at = now() AT TIME ZONE 'utc'"
            + " WHERE id = %s"
            + " RETURNING id, title, summary, NULL AS detail, category, image_url, link_url, "
            "is_published, created_at, updated_at, published_at"
        )
        row = db_fetch_one(fallback_query, tuple(legacy_params))
    return db_row_to_update(row)


def get_project_update(update_id: str) -> dict | None:
    """Fetch a single project update by id."""
    if not db_enabled():
        return None
    row = db_fetch_one(
        "SELECT id, title, summary, detail, category, image_url, link_url, "
        "is_published, created_at, updated_at, published_at "
        "FROM project_updates WHERE id = %s",
        (update_id,),
    )
    return db_row_to_update(row)


def delete_project_update(update_id: str) -> bool:
    """Delete a project update record."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    try:
        affected = db_execute("DELETE FROM project_updates WHERE id = %s", (update_id,))
    except psycopg_errors.UndefinedTable as exc:
        raise RuntimeError(
            "Project updates table is missing. Run the migration in the setup guide."
        ) from exc
    return affected > 0


# Volunteer registrations and events -----------------------------------------


def db_row_to_volunteer_registration(row: dict | None) -> dict | None:
    """Convert volunteer registration row to payload."""
    if not row:
        return None
    return {
        "id": str(row.get("id")),
        "name": (row.get("name") or "").strip(),
        "email": (row.get("email") or "").strip(),
        "phone": (row.get("phone") or "").strip(),
        "interest": (row.get("interest") or "").strip(),
        "availability": (row.get("availability") or "").strip(),
        "notes": (row.get("notes") or "").strip(),
        "eventId": str(row.get("event_id")) if row.get("event_id") else "",
        "eventTitle": (row.get("event_title") or "").strip(),
        "userId": str(row.get("user_id")) if row.get("user_id") else "",
        "createdAt": format_timestamp(row.get("created_at")),
    }


def find_volunteer_registration_by_email(email: str) -> dict | None:
    """Find the most recent volunteer registration by email."""
    if not db_enabled():
        return None
    query = (
        "SELECT id, name, email, phone, interest, availability, notes, event_id, event_title, user_id, created_at "
        "FROM volunteer_registrations "
        "WHERE lower(email) = lower(%s) "
        "ORDER BY created_at DESC "
        "LIMIT 1"
    )
    row = db_fetch_one(query, (email,))
    return db_row_to_volunteer_registration(row)


def list_volunteer_registrations_by_email(email: str) -> list[dict]:
    """List volunteer registrations by email newest first."""
    if not db_enabled():
        return []
    query = (
        "SELECT id, name, email, phone, interest, availability, notes, event_id, event_title, user_id, created_at "
        "FROM volunteer_registrations "
        "WHERE lower(email) = lower(%s) "
        "ORDER BY created_at DESC"
    )
    rows = db_fetch_all(query, (email,))
    return [db_row_to_volunteer_registration(row) for row in rows if row]


def find_volunteer_registration_by_email_and_event(email: str, event_id: str | None) -> dict | None:
    """Find a registration by email and event id (or general interest)."""
    if not db_enabled():
        return None
    if event_id:
        query = (
            "SELECT id, name, email, phone, interest, availability, notes, event_id, event_title, user_id, created_at "
            "FROM volunteer_registrations WHERE lower(email) = lower(%s) AND event_id = %s "
            "ORDER BY created_at DESC LIMIT 1"
        )
        params = (email, event_id)
    else:
        query = (
            "SELECT id, name, email, phone, interest, availability, notes, event_id, event_title, user_id, created_at "
            "FROM volunteer_registrations WHERE lower(email) = lower(%s) AND event_id IS NULL "
            "ORDER BY created_at DESC LIMIT 1"
        )
        params = (email,)
    row = db_fetch_one(query, params)
    return db_row_to_volunteer_registration(row)


def list_volunteer_registrations(limit: int | None = None) -> list[dict]:
    """List volunteer registrations newest first."""
    if not db_enabled():
        return []
    query = (
        "SELECT id, name, email, phone, interest, availability, notes,"
        " event_id, event_title, user_id, created_at"
        " FROM volunteer_registrations"
        " ORDER BY created_at DESC"
    )
    if limit:
        query += " LIMIT %s"
        params = (limit,)
    else:
        params = None
    try:
        rows = db_fetch_all(query, params)
    except psycopg_errors.UndefinedTable:
        return []
    except psycopg_errors.UndefinedColumn:
        fallback_query = (
            "SELECT id, name, email, phone, interest, availability, notes,"
            " event_id, event_title, created_at"
            " FROM volunteer_registrations"
            " ORDER BY created_at DESC"
        )
        if limit:
            fallback_query += " LIMIT %s"
            rows = db_fetch_all(fallback_query, params)
        else:
            rows = db_fetch_all(fallback_query)
    return [db_row_to_volunteer_registration(row) for row in rows if row]


def list_user_volunteer_registrations(user_id: str) -> list[dict]:
    """List volunteer registrations for a specific user."""
    if not db_enabled():
        return []
    query = (
        "SELECT id, name, email, phone, interest, availability, notes,"
        " event_id, event_title, user_id, created_at"
        " FROM volunteer_registrations"
        " WHERE user_id = %s"
        " ORDER BY created_at DESC"
    )
    try:
        rows = db_fetch_all(query, (user_id,))
    except psycopg_errors.UndefinedTable:
        return []
    except psycopg_errors.UndefinedColumn:
        return []
    return [db_row_to_volunteer_registration(row) for row in rows if row]


def create_volunteer_registration(payload: dict) -> dict:
    """Create a volunteer registration entry."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    query = (
        "INSERT INTO volunteer_registrations "
        "(name, email, phone, interest, availability, notes, event_id, event_title, user_id)"
        " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"
        " RETURNING id, name, email, phone, interest, availability, notes,"
        " event_id, event_title, user_id, created_at"
    )
    params = (
        (payload.get("name") or "").strip() or None,
        (payload.get("email") or "").strip(),
        (payload.get("phone") or "").strip() or None,
        (payload.get("interest") or "").strip() or None,
        (payload.get("availability") or "").strip() or None,
        (payload.get("notes") or "").strip() or None,
        payload.get("eventId") or None,
        (payload.get("eventTitle") or "").strip() or None,
        payload.get("userId") or None,
    )
    try:
        row = db_fetch_one(query, params)
    except psycopg_errors.UndefinedTable as exc:
        raise RuntimeError(
            "Volunteer registrations table is missing. Run the migration SQL."
        ) from exc
    except psycopg_errors.UndefinedColumn:
        fallback_query = (
            "INSERT INTO volunteer_registrations "
            "(name, email, phone, interest, availability, notes, event_id, event_title)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
            " RETURNING id, name, email, phone, interest, availability, notes,"
            " event_id, event_title, created_at"
        )
        fallback_params = params[:-1]
        row = db_fetch_one(fallback_query, fallback_params)
    return db_row_to_volunteer_registration(row)


def update_volunteer_registration(registration_id: str, payload: dict) -> dict | None:
    """Update an existing volunteer registration."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    query = (
        "UPDATE volunteer_registrations SET "
        " name = %s, email = %s, phone = %s, interest = %s, availability = %s, notes = %s,"
        " event_id = %s, event_title = %s, user_id = %s, created_at = NOW()"
        " WHERE id = %s"
        " RETURNING id, name, email, phone, interest, availability, notes, event_id, event_title, user_id, created_at"
    )
    params = (
        (payload.get("name") or "").strip() or None,
        (payload.get("email") or "").strip(),
        (payload.get("phone") or "").strip() or None,
        (payload.get("interest") or "").strip() or None,
        (payload.get("availability") or "").strip() or None,
        (payload.get("notes") or "").strip() or None,
        payload.get("eventId") or None,
        (payload.get("eventTitle") or "").strip() or None,
        payload.get("userId") or None,
        registration_id,
    )
    row = db_fetch_one(query, params)
    return db_row_to_volunteer_registration(row)


def delete_volunteer_registration(registration_id: str, user_id: str | None = None) -> bool:
    """Delete a volunteer registration. If user_id provided, ensure ownership."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    where = "id = %s"
    params: list = [registration_id]
    if user_id:
        where += " AND user_id = %s"
        params.append(user_id)
    try:
        affected = db_execute(
            f"DELETE FROM volunteer_registrations WHERE {where}",
            tuple(params),
        )
    except psycopg_errors.UndefinedTable as exc:
        raise RuntimeError(
            "Volunteer registrations table is missing. Run the migration SQL."
        ) from exc
    except psycopg_errors.UndefinedColumn:
        affected = db_execute(
            "DELETE FROM volunteer_registrations WHERE id = %s",
            (registration_id,),
        )
    return affected > 0


def db_row_to_volunteer_event(row: dict | None) -> dict | None:
    """Convert volunteer event row to payload."""
    if not row:
        return None
    raw_date = row.get("date")
    if isinstance(raw_date, date):
        date_value = raw_date.isoformat()
    else:
        date_value = str(raw_date) if raw_date else ""
    return {
        "id": str(row.get("id")),
        "title": (row.get("title") or "").strip(),
        "date": date_value,
        "description": (row.get("description") or "").strip(),
        "linkText": (row.get("link_text") or "").strip(),
        "linkUrl": (row.get("link_url") or "").strip(),
        "imageUrl": (row.get("image_url") or "").strip(),
        "createdAt": format_timestamp(row.get("created_at")),
        "updatedAt": format_timestamp(row.get("updated_at")),
    }


def list_volunteer_events(include_past: bool = True) -> list[dict]:
    """List volunteer events ordered by date."""
    if not db_enabled():
        return []
    where = ""
    params: tuple = ()
    if not include_past:
        where = "WHERE date >= CURRENT_DATE"
    query = (
        "SELECT id, title, date, description, link_text, link_url, image_url, "
        " created_at, updated_at"
        " FROM volunteer_events "
        f"{where}"
        " ORDER BY date ASC, created_at DESC"
    )
    try:
        rows = db_fetch_all(query, params)
    except psycopg_errors.UndefinedTable:
        return []
    except psycopg_errors.UndefinedColumn:
        fallback_query = (
            "SELECT id, title, date, description, link_text, link_url, NULL AS image_url, "
            " created_at, updated_at"
            " FROM volunteer_events "
            f"{where}"
            " ORDER BY date ASC, created_at DESC"
        )
        rows = db_fetch_all(fallback_query, params)
    return [db_row_to_volunteer_event(row) for row in rows if row]


def get_volunteer_event(event_id: str) -> dict | None:
    """Fetch single volunteer event."""
    if not db_enabled():
        return None
    try:
        row = db_fetch_one(
            "SELECT id, title, date, description, link_text, link_url, image_url, created_at, updated_at "
            "FROM volunteer_events WHERE id = %s",
            (event_id,),
        )
    except psycopg_errors.UndefinedTable:
        return None
    except psycopg_errors.UndefinedColumn:
        row = db_fetch_one(
            "SELECT id, title, date, description, link_text, link_url, NULL AS image_url, created_at, updated_at "
            "FROM volunteer_events WHERE id = %s",
            (event_id,),
        )
    return db_row_to_volunteer_event(row)


def create_volunteer_event(payload: dict) -> dict:
    """Create volunteer event."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    query = (
        "INSERT INTO volunteer_events "
        "(title, date, description, link_text, link_url, image_url)"
        " VALUES (%s, %s, %s, %s, %s, %s)"
        " RETURNING id, title, date, description, link_text, link_url, image_url, created_at, updated_at"
    )
    params = (
        (payload.get("title") or "").strip(),
        payload.get("date"),
        (payload.get("description") or "").strip() or None,
        (payload.get("linkText") or "").strip() or None,
        (payload.get("linkUrl") or "").strip() or None,
        (payload.get("imageUrl") or "").strip() or None,
    )
    try:
        row = db_fetch_one(query, params)
    except psycopg_errors.UndefinedTable as exc:
        raise RuntimeError(
            "Volunteer events table is missing. Run the migration SQL."
        ) from exc
    except psycopg_errors.UndefinedColumn:
        fallback_query = (
            "INSERT INTO volunteer_events "
            "(title, date, description, link_text, link_url)"
            " VALUES (%s, %s, %s, %s, %s)"
            " RETURNING id, title, date, description, link_text, link_url, created_at, updated_at"
        )
        fallback_params = params[:-1]
        row = db_fetch_one(fallback_query, fallback_params)
    return db_row_to_volunteer_event(row)


def update_volunteer_event(event_id: str, payload: dict) -> dict | None:
    """Update volunteer event."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    fields = []
    params: list = []
    if "title" in payload:
        fields.append("title = %s")
        params.append((payload.get("title") or "").strip())
    if "date" in payload:
        fields.append("date = %s")
        params.append(payload.get("date"))
    if "description" in payload:
        fields.append("description = %s")
        params.append((payload.get("description") or "").strip() or None)
    if "linkText" in payload:
        fields.append("link_text = %s")
        params.append((payload.get("linkText") or "").strip() or None)
    if "linkUrl" in payload:
        fields.append("link_url = %s")
        params.append((payload.get("linkUrl") or "").strip() or None)
    if "imageUrl" in payload:
        fields.append("image_url = %s")
        params.append((payload.get("imageUrl") or "").strip() or None)
    if not fields:
        return get_volunteer_event(event_id)
    params.append(event_id)
    query = (
        "UPDATE volunteer_events SET "
        + ", ".join(fields)
        + ", updated_at = now()"
        + " WHERE id = %s"
        + " RETURNING id, title, date, description, link_text, link_url, image_url, created_at, updated_at"
    )
    try:
        row = db_fetch_one(query, tuple(params))
    except psycopg_errors.UndefinedTable as exc:
        raise RuntimeError(
            "Volunteer events table is missing. Run the migration SQL."
        ) from exc
    except psycopg_errors.UndefinedColumn:
        legacy_fields = [field for field in fields if not field.startswith("image_url")]
        legacy_params = [
            value
            for field, value in zip(fields, params[:-1])
            if not field.startswith("image_url")
        ]
        legacy_params.append(params[-1])
        if not legacy_fields:
            return get_volunteer_event(event_id)
        legacy_query = (
            "UPDATE volunteer_events SET "
            + ", ".join(legacy_fields)
            + ", updated_at = now()"
            + " WHERE id = %s"
            + " RETURNING id, title, date, description, link_text, link_url, created_at, updated_at"
        )
        row = db_fetch_one(legacy_query, tuple(legacy_params))
        return db_row_to_volunteer_event(row)
    return db_row_to_volunteer_event(row)


def delete_volunteer_event(event_id: str) -> bool:
    """Delete volunteer event."""
    if not db_enabled():
        raise RuntimeError("User database not configured")
    try:
        affected = db_execute("DELETE FROM volunteer_events WHERE id = %s", (event_id,))
    except psycopg_errors.UndefinedTable as exc:
        raise RuntimeError(
            "Volunteer events table is missing. Run the migration SQL."
        ) from exc
    return affected > 0


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
