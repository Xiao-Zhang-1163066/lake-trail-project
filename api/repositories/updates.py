"""Project updates repository functions."""

from __future__ import annotations

from psycopg import errors as psycopg_errors

from utils import format_timestamp

from .core import db_enabled, db_execute, db_fetch_all, db_fetch_one


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

