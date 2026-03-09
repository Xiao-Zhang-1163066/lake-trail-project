"""Gallery media management."""

import base64
import binascii
import json
import mimetypes
import os
import re
import uuid
from datetime import datetime
from pathlib import Path

import azure.functions as func
from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import BlobServiceClient, ContentSettings, PublicAccess
import requests

from config import (
    DEFAULT_LOCAL_GALLERY_DIR,
    GALLERY_CONN,
    USE_LOCAL_GALLERY,
    GALLERY_CONTAINER,
    GALLERY_METADATA_BLOB,
    GALLERY_ADMIN_KEY,
    USE_SUPABASE_GALLERY,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_GALLERY_BUCKET,
    SUPABASE_GALLERY_PATH_PREFIX,
    SUPABASE_GALLERY_PUBLIC,
)
from auth import get_current_admin


_CONTAINER_CLIENT = None
_SUPABASE_SESSION = None


def supabase_session() -> requests.Session:
    """Get cached Supabase session."""
    global _SUPABASE_SESSION
    if _SUPABASE_SESSION is None:
        _SUPABASE_SESSION = requests.Session()
    return _SUPABASE_SESSION


def supabase_object_name(name: str) -> str:
    """Apply optional path prefix to Supabase object key."""
    name = name.lstrip("/")
    if SUPABASE_GALLERY_PATH_PREFIX:
        return f"{SUPABASE_GALLERY_PATH_PREFIX}/{name}"
    return name


def supabase_storage_request(
    method: str, path: str, *, allow_status: set[int] | None = None, **kwargs
) -> requests.Response:
    """Perform an HTTP request to Supabase Storage.

    Raises RuntimeError on transport errors or unexpected HTTP status codes.
    """
    if not USE_SUPABASE_GALLERY:
        raise RuntimeError("Supabase storage not configured")
    session = supabase_session()
    url = f"{SUPABASE_URL}/storage/v1/{path.lstrip('/')}"
    headers = kwargs.pop("headers", {})
    headers.setdefault("apikey", SUPABASE_SERVICE_ROLE_KEY)
    headers.setdefault("Authorization", f"Bearer {SUPABASE_SERVICE_ROLE_KEY}")
    try:
        response = session.request(
            method.upper(), url, headers=headers, timeout=30, **kwargs
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"Supabase storage request failed: {exc}") from exc

    allow_status = allow_status or set()
    if response.status_code == 400 and 404 in allow_status:
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        error_code = (payload.get("error") or "").lower()
        message = (payload.get("message") or "").lower()
        if error_code == "not_found" or "not found" in message:
            response.status_code = 404
            return response
    if response.status_code in allow_status:
        return response
    if response.status_code >= 400:
        message = response.text.strip()
        if len(message) > 200:
            message = message[:197] + "..."
        raise RuntimeError(
            f"Supabase storage error {response.status_code}: {message or 'unknown error'}"
        )
    return response


def resolve_local_gallery_dir() -> Path:
    """Resolve the local gallery directory path."""
    custom = os.environ.get("GALLERY_LOCAL_DIR")
    if custom:
        resolved = Path(custom).expanduser().resolve()
        resolved.mkdir(parents=True, exist_ok=True)
        return resolved
    DEFAULT_LOCAL_GALLERY_DIR.mkdir(parents=True, exist_ok=True)
    return DEFAULT_LOCAL_GALLERY_DIR


def get_local_gallery_dir() -> Path:
    """Get the cached local gallery directory path."""
    if not hasattr(get_local_gallery_dir, "_cached"):
        setattr(get_local_gallery_dir, "_cached", resolve_local_gallery_dir())
    return getattr(get_local_gallery_dir, "_cached")


def ensure_local_dir() -> None:
    """Ensure local gallery directory exists."""
    get_local_gallery_dir()


def local_metadata_path() -> Path:
    """Get the path to local metadata file."""
    return get_local_gallery_dir() / GALLERY_METADATA_BLOB


def load_metadata() -> list:
    """Load gallery metadata."""
    if USE_LOCAL_GALLERY:
        ensure_local_dir()
        metadata_file = local_metadata_path()
        if metadata_file.exists():
            try:
                data = json.loads(metadata_file.read_text("utf-8"))
                if isinstance(data, list):
                    return data
            except (OSError, ValueError):
                pass
        return []
    if USE_SUPABASE_GALLERY:
        object_name = supabase_object_name(GALLERY_METADATA_BLOB)
        response = supabase_storage_request(
            "get",
            f"object/{SUPABASE_GALLERY_BUCKET}/{object_name}",
            allow_status={404},
        )
        if response.status_code == 404:
            return []
        try:
            payload = response.json()
            if isinstance(payload, list):
                return payload
        except ValueError:
            # Response was not valid JSON; fall back to attempt manual decode.
            try:
                data = response.text
                payload = json.loads(data)
                if isinstance(payload, list):
                    return payload
            except ValueError:
                pass
        return []

    container = get_container()
    blob = container.get_blob_client(GALLERY_METADATA_BLOB)
    try:
        data = blob.download_blob().readall().decode("utf-8")
    except ResourceNotFoundError:
        return []
    try:
        payload = json.loads(data)
        if isinstance(payload, list):
            return payload
    except ValueError:
        pass
    return []


def save_metadata(records: list) -> None:
    """Save gallery metadata."""
    payload = json.dumps(records, ensure_ascii=False, indent=2)
    if USE_LOCAL_GALLERY:
        metadata_file = local_metadata_path()
        metadata_file.parent.mkdir(parents=True, exist_ok=True)
        metadata_file.write_text(payload, encoding="utf-8")
        return
    if USE_SUPABASE_GALLERY:
        object_name = supabase_object_name(GALLERY_METADATA_BLOB)
        response = supabase_storage_request(
            "put",
            f"object/{SUPABASE_GALLERY_BUCKET}/{object_name}",
            data=payload.encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-upsert": "true",
            },
        )
        response.raise_for_status()
        return

    container = get_container()
    blob = container.get_blob_client(GALLERY_METADATA_BLOB)
    blob.upload_blob(payload, overwrite=True, content_settings=ContentSettings(
        content_type="application/json"
    ))


def get_container():
    """Get or create the blob storage container."""
    global _CONTAINER_CLIENT
    if USE_LOCAL_GALLERY:
        raise RuntimeError("Blob storage not configured; using local filesystem")
    if not GALLERY_CONN:
        raise RuntimeError("Gallery storage connection not configured")
    if _CONTAINER_CLIENT is None:
        service = BlobServiceClient.from_connection_string(GALLERY_CONN)
        _CONTAINER_CLIENT = service.get_container_client(GALLERY_CONTAINER)
        try:
            _CONTAINER_CLIENT.get_container_properties()
        except ResourceNotFoundError:
            _CONTAINER_CLIENT.create_container(public_access=PublicAccess.Blob)
        else:
            props = _CONTAINER_CLIENT.get_container_properties()
            if props.get("public_access") != "blob":
                _CONTAINER_CLIENT.set_container_access_policy(
                    public_access=PublicAccess.Blob
                )
    return _CONTAINER_CLIENT


def sanitize_filename(filename: str) -> str:
    """Sanitize a filename for safe storage."""
    if not filename:
        return "photo"
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", filename)
    return cleaned[:120]


def detect_extension(filename: str, content_type: str | None) -> str:
    """Detect file extension from filename or content type."""
    if "." in filename:
        ext = filename.rsplit(".", 1)[1].lower()
        if ext:
            return ext
    if content_type:
        guess = mimetypes.guess_extension(content_type)
        if guess:
            return guess.lstrip(".")
    return "jpg"


def parse_data_uri(data: str) -> tuple[bytes, str | None]:
    """Parse a data URI and extract binary data and MIME type."""
    if not data:
        raise ValueError("Missing data field")
    if "," in data:
        header, encoded = data.split(",", 1)
        if header.startswith("data:") and ";base64" in header:
            mime = header[5 : header.index(";")]
        else:
            mime = None
    else:
        encoded = data
        mime = None
    return base64.b64decode(encoded), mime


def require_admin(req: func.HttpRequest) -> bool:
    """Check if request is authorized as admin."""
    user, error = get_current_admin(req, require=False)
    if user:
        return True
    if error:
        return False
    if not GALLERY_ADMIN_KEY:
        return False
    provided = req.headers.get("X-Admin-Key")
    return provided == GALLERY_ADMIN_KEY


def gallery_list(include_unapproved: bool = True) -> list:
    """Get list of gallery items."""
    records = load_metadata()
    items = sorted(records, key=lambda item: item.get("uploadedAt", ""), reverse=True)
    if include_unapproved:
        return items
    return [item for item in items if item.get("approved", True)]


def add_gallery_entry(payload: dict, source: str) -> dict:
    """Add a new gallery entry."""
    try:
        data, mime_from_data = parse_data_uri(payload.get("data"))
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Invalid image payload") from exc

    if len(data) > 5 * 1024 * 1024:
        raise ValueError("Image exceeds 5 MB limit")

    filename = sanitize_filename(payload.get("filename", "photo"))
    content_type = payload.get("contentType") or mime_from_data or "image/jpeg"
    ext = detect_extension(filename, content_type)
    item_id = str(uuid.uuid4())
    blob_name = f"{item_id}.{ext}"

    if USE_LOCAL_GALLERY:
        file_path = get_local_gallery_dir() / blob_name
        file_path.write_bytes(data)
        url = f"/gallery-media/{blob_name}"
    elif USE_SUPABASE_GALLERY:
        object_name = supabase_object_name(blob_name)
        response = supabase_storage_request(
            "put",
            f"object/{SUPABASE_GALLERY_BUCKET}/{object_name}",
            data=data,
            headers={
                "Content-Type": content_type,
                "x-upsert": "true",
            },
        )
        response.raise_for_status()
        if SUPABASE_GALLERY_PUBLIC:
            url = (
                f"{SUPABASE_URL}/storage/v1/object/public/"
                f"{SUPABASE_GALLERY_BUCKET}/{object_name}"
            )
        else:
            url = object_name
    else:
        container = get_container()
        blob = container.get_blob_client(blob_name)
        blob.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
        url = f"{container.url}/{blob_name}"

    records = load_metadata()
    entry = {
        "id": item_id,
        "blob": blob_name,
        "url": url,
        "filename": filename,
        "contentType": content_type,
        "caption": (payload.get("caption") or "").strip(),
        "uploader": (payload.get("uploader") or "").strip(),
        "source": source,
        "approved": True,
        "uploadedAt": datetime.utcnow().isoformat() + "Z",
    }
    records.append(entry)
    save_metadata(records)
    return entry


def store_project_update_image(payload: dict) -> dict:
    """Store image for project updates and return its URL."""
    try:
        data, mime_from_data = parse_data_uri(payload.get("data"))
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Invalid image payload") from exc

    if len(data) > 5 * 1024 * 1024:
        raise ValueError("Image exceeds 5 MB limit")

    filename = sanitize_filename(payload.get("filename", "update"))
    content_type = payload.get("contentType") or mime_from_data or "image/jpeg"
    ext = detect_extension(filename, content_type)
    item_id = str(uuid.uuid4())
    relative_name = f"updates/{item_id}.{ext}"

    if USE_LOCAL_GALLERY:
        file_path = get_local_gallery_dir() / relative_name
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        url = f"/gallery-media/{relative_name}"
    elif USE_SUPABASE_GALLERY:
        object_name = supabase_object_name(relative_name)
        response = supabase_storage_request(
            "put",
            f"object/{SUPABASE_GALLERY_BUCKET}/{object_name}",
            data=data,
            headers={
                "Content-Type": content_type,
                "x-upsert": "true",
            },
        )
        response.raise_for_status()
        if SUPABASE_GALLERY_PUBLIC:
            url = (
                f"{SUPABASE_URL}/storage/v1/object/public/"
                f"{SUPABASE_GALLERY_BUCKET}/{object_name}"
            )
        else:
            url = object_name
    else:
        container = get_container()
        blob = container.get_blob_client(relative_name)
        blob.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
        url = f"{container.url}/{relative_name}"

    return {
        "id": item_id,
        "blob": relative_name,
        "url": url,
        "contentType": content_type,
    }


def store_volunteer_event_image(payload: dict) -> dict:
    """Store image for volunteer events and return its URL."""
    try:
        data, mime_from_data = parse_data_uri(payload.get("data"))
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Invalid image payload") from exc

    if len(data) > 5 * 1024 * 1024:
        raise ValueError("Image exceeds 5 MB limit")

    filename = sanitize_filename(payload.get("filename", "volunteer"))
    content_type = payload.get("contentType") or mime_from_data or "image/jpeg"
    ext = detect_extension(filename, content_type)
    item_id = str(uuid.uuid4())
    relative_name = f"volunteer-events/{item_id}.{ext}"

    if USE_LOCAL_GALLERY:
        file_path = get_local_gallery_dir() / relative_name
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        url = f"/gallery-media/{relative_name}"
    elif USE_SUPABASE_GALLERY:
        object_name = supabase_object_name(relative_name)
        response = supabase_storage_request(
            "put",
            f"object/{SUPABASE_GALLERY_BUCKET}/{object_name}",
            data=data,
            headers={
                "Content-Type": content_type,
                "x-upsert": "true",
            },
        )
        response.raise_for_status()
        if SUPABASE_GALLERY_PUBLIC:
            url = (
                f"{SUPABASE_URL}/storage/v1/object/public/"
                f"{SUPABASE_GALLERY_BUCKET}/{object_name}"
            )
        else:
            url = object_name
    else:
        container = get_container()
        blob = container.get_blob_client(relative_name)
        blob.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
        url = f"{container.url}/{relative_name}"

    return {
        "id": item_id,
        "blob": relative_name,
        "url": url,
        "contentType": content_type,
    }


def delete_gallery_entry(item_id: str) -> bool:
    """Delete a gallery entry."""
    records = load_metadata()
    remaining = [r for r in records if r.get("id") != item_id]
    if len(remaining) == len(records):
        return False

    blob_name = next((r.get("blob") for r in records if r.get("id") == item_id), None)
    if blob_name:
        if USE_LOCAL_GALLERY:
            file_path = get_local_gallery_dir() / blob_name
            if file_path.exists():
                try:
                    file_path.unlink()
                except OSError:
                    pass
        elif USE_SUPABASE_GALLERY:
            object_name = supabase_object_name(blob_name)
            response = supabase_storage_request(
                "delete",
                f"object/{SUPABASE_GALLERY_BUCKET}/{object_name}",
                allow_status={404},
            )
        else:
            container = get_container()
            blob = container.get_blob_client(blob_name)
            try:
                blob.delete_blob()
            except ResourceNotFoundError:
                pass

    save_metadata(remaining)
    return True
