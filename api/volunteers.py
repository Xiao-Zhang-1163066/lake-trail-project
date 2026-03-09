"""Volunteer registration and event management."""

import json
import uuid
from datetime import datetime
import azure.functions as func

from config import (
    VOLUNTEER_DATA_PATH,
    VOLUNTEER_EVENTS_PATH,
    VOLUNTEER_ADMIN_KEY,
)
from auth import get_current_admin
from utils import text_response, normalize_email
from database import (
    db_enabled,
    list_volunteer_registrations,
    create_volunteer_registration,
    find_volunteer_registration_by_email,
    find_volunteer_registration_by_email_and_event,
    update_volunteer_registration,
    list_volunteer_events,
    create_volunteer_event,
    update_volunteer_event,
    delete_volunteer_event,
    list_user_volunteer_registrations,
    list_volunteer_registrations_by_email,
    delete_volunteer_registration,
)

SEED_VOLUNTEER_EVENTS: list[dict] = [
    {
        "id": "seed-kaituna-boardwalk-20250215",
        "title": "Kaituna Boardwalk Build Weekend",
        "date": "2025-02-15",
        "description": (
            "Two days of decking installation and track edging along the Kaituna "
            "wetland loop. Tools, safety gear, and kai provided."
        ),
        "linkText": "Reserve a spot",
        "linkUrl": "",
        "imageUrl": "/gallery-media/IMG_1004.jpg",
    },
    {
        "id": "seed-te-waihora-nightwalk-20250308",
        "title": "Stars over Te Waihora Hikoi",
        "date": "2025-03-08",
        "description": (
            "Evening hikoi guided by mana whenua sharing night-sky stories and the "
            "habits of nocturnal wildlife that thrive around Te Waihora."
        ),
        "linkText": "Join the hikoi",
        "linkUrl": "",
        "imageUrl": "/gallery-media/IMG_1354-2.jpg",
    },
    {
        "id": "seed-roto-wairewa-planting-20250412",
        "title": "Roto o Wairewa Whānau Planting Day",
        "date": "2025-04-12",
        "description": (
            "Plant riparian seedlings beside Roto o Wairewa, enjoy kōrero with "
            "rangatahi leaders, and share a whānau-style potluck lunch."
        ),
        "linkText": "Help plant natives",
        "linkUrl": "",
        "imageUrl": "/gallery-media/update2.jpg",
    },
]


def normalize_event_id(raw: str | None) -> str | None:
    """Normalize event identifiers to UUID strings."""
    if not raw:
        return None
    value = str(raw).strip()
    if not value:
        return None
    try:
        # Return canonical lowercase UUID string when already valid.
        return str(uuid.UUID(value))
    except (ValueError, AttributeError, TypeError):
        # Derive a stable UUID from the provided key so seeds/files remain consistent.
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"volunteer-event:{value}"))

def authorize_admin(req: func.HttpRequest) -> func.HttpResponse | None:
    """Authorize request as admin using JWT or admin key."""
    user, error = get_current_admin(req, require=False)
    if error:
        return error
    if user:
        return None
    if not VOLUNTEER_ADMIN_KEY:
        return None
    provided = req.headers.get("X-Admin-Key")
    if provided != VOLUNTEER_ADMIN_KEY:
        return text_response("Unauthorized", status=401)
    return None


def load_volunteers() -> list:
    """Load volunteer registrations."""
    if db_enabled():
        return list_volunteer_registrations()
    # Fallback to legacy JSON file
    if not VOLUNTEER_DATA_PATH.exists():
        return []
    try:
        data = VOLUNTEER_DATA_PATH.read_text("utf-8")
        items = json.loads(data)
        if isinstance(items, list):
            return items
    except (OSError, ValueError):
        pass
    return []


def save_volunteers(records: list) -> None:
    """Save volunteer registrations to file."""
    VOLUNTEER_DATA_PATH.write_text(
        json.dumps(records, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def add_volunteer_entry(payload: dict, current_user: dict | None = None) -> dict:
    """Add a new volunteer registration."""
    email = normalize_email(payload.get("email"))
    if not email:
        raise ValueError("Email is required")
    raw_event_id = (payload.get("eventId") or "").strip()
    normalized_event_id = normalize_event_id(raw_event_id)
    event_id_for_storage = normalized_event_id or None
    entry_payload = {
        "name": (payload.get("name") or "").strip(),
        "email": email,
        "phone": (payload.get("phone") or "").strip(),
        "interest": (payload.get("interest") or "").strip(),
        "availability": (payload.get("availability") or "").strip(),
        "notes": (payload.get("notes") or "").strip(),
        "eventId": event_id_for_storage,
        "eventTitle": (payload.get("eventTitle") or "").strip(),
        "userId": (current_user or {}).get("id"),
    }
    if current_user:
        if not entry_payload["name"]:
            entry_payload["name"] = (current_user.get("name") or "").strip()
        if not entry_payload["email"]:
            entry_payload["email"] = (current_user.get("email") or "").strip()
    if db_enabled():
        lookup_event_ids: list[str | None] = []
        if event_id_for_storage:
            lookup_event_ids.append(event_id_for_storage)
        if not lookup_event_ids:
            lookup_event_ids.append(None)
        existing = None
        for candidate_id in lookup_event_ids:
            existing = find_volunteer_registration_by_email_and_event(email, candidate_id)
            if existing:
                break
        if existing:
            entry_payload["id"] = existing.get("id")
            return update_volunteer_registration(existing.get("id"), entry_payload)
        return create_volunteer_registration(entry_payload)

    name = (payload.get("name") or "").strip()
    phone = (payload.get("phone") or "").strip()
    interest = (payload.get("interest") or "").strip()
    availability = (payload.get("availability") or "").strip()
    notes = (payload.get("notes") or "").strip()
    event_title = (payload.get("eventTitle") or "").strip()

    entry = {
        "id": str(uuid.uuid4()),
        "name": name,
        "email": email,
        "phone": phone,
        "interest": interest,
        "availability": availability,
        "notes": notes,
        "eventId": normalized_event_id or raw_event_id,
        "eventTitle": event_title,
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "userId": (current_user or {}).get("id") or "",
    }
    records = load_volunteers()
    replaced = False
    for idx, item in enumerate(records):
        if normalize_email(item.get("email")) == email:
            existing_event = (item.get("eventId") or "").strip()
            candidates: list[str] = []
            for candidate in (normalized_event_id, raw_event_id):
                candidate_value = (candidate or "").strip()
                if candidate_value:
                    candidates.append(candidate_value)
            if candidates:
                if any(existing_event == candidate for candidate in candidates):
                    records[idx] = entry
                    replaced = True
                    break
            elif not existing_event:
                records[idx] = entry
                replaced = True
                break
    if not replaced:
        records.append(entry)
    records.sort(key=lambda item: item.get("createdAt", ""), reverse=True)
    save_volunteers(records)
    return entry


def list_volunteer_registrations_for_user(user_id: str, email: str) -> list:
    """Get volunteer registrations for a specific user or email."""
    normalized_email = (email or "").strip().lower()

    if db_enabled():
        user_items = list_user_volunteer_registrations(user_id) if user_id else []
        email_items = []
        if normalized_email:
            email_items = list_volunteer_registrations_by_email(email)
        merged: dict[str, dict] = {}
        for item in user_items + email_items:
            if not item:
                continue
            item_email = (item.get("email") or "").strip().lower()
            if normalized_email and item_email != normalized_email:
                continue
            merged[item["id"]] = item
        if merged:
            return sorted(
                merged.values(),
                key=lambda value: value.get("createdAt") or "",
                reverse=True,
            )
        records = list_volunteer_registrations()
    else:
        records = load_volunteers()

    return [
        item
        for item in records
        if (item.get("userId") == user_id)
        or (item.get("email", "").strip().lower() == normalized_email)
    ]


def remove_volunteer_registration(registration_id: str, user_id: str, email: str | None = None) -> bool:
    """Remove a registration for a user."""
    if db_enabled():
        return delete_volunteer_registration(
            registration_id, user_id=user_id
        )
    records = load_volunteers()
    normalized_email = (email or "").strip().lower()
    remaining = []
    removed = False
    for item in records:
        matches = item.get("id") == registration_id and (
            item.get("userId") == user_id
            or (item.get("email") or "").strip().lower() == normalized_email
        )
        if matches:
            removed = True
            continue
        remaining.append(item)
    if not removed:
        return False
    save_volunteers(remaining)
    return True


def load_events() -> list:
    """Load volunteer events."""
    records: list[dict] = []
    if db_enabled():
        records = list_volunteer_events(include_past=True) or []
        if records:
            return records

    if VOLUNTEER_EVENTS_PATH.exists():
        try:
            data = VOLUNTEER_EVENTS_PATH.read_text("utf-8")
            items = json.loads(data)
            if isinstance(items, list):
                items = [item for item in items if isinstance(item, dict)]
                if items:
                    records = items
                    # Continue to normalization below.
        except (OSError, ValueError):
            pass

    if not records:
        records = [dict(item) for item in SEED_VOLUNTEER_EVENTS]

    normalized: list[dict] = []
    for item in records:
        event = dict(item)
        event_id = event.get("id") or event.get("eventId") or event.get("slug")
        event["id"] = normalize_event_id(event_id or event.get("title") or uuid.uuid4().hex)
        event["imageUrl"] = (event.get("imageUrl") or "").strip()
        normalized.append(event)
    return normalized


def save_events(records: list) -> None:
    """Save volunteer events to file."""
    VOLUNTEER_EVENTS_PATH.write_text(
        json.dumps(records, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def normalize_event(payload: dict) -> dict:
    """Normalize and validate event data."""
    title = (payload.get("title") or "").strip()
    if not title:
        raise ValueError("Title is required")
    date = (payload.get("date") or "").strip()
    if not date:
        raise ValueError("Date is required (YYYY-MM-DD)")
    description = (payload.get("description") or "").strip()
    link_text = (payload.get("linkText") or "").strip()
    link_url = (payload.get("linkUrl") or "").strip()
    image_url = (payload.get("imageUrl") or "").strip()
    event = {
        "title": title,
        "date": date,
        "description": description,
        "linkText": link_text,
        "linkUrl": link_url,
        "imageUrl": image_url,
    }
    return event


def create_event(payload: dict) -> dict:
    """Create a new volunteer event."""
    event = normalize_event(payload)
    if db_enabled():
        return create_volunteer_event(event)
    event_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    event.update({
        "id": event_id,
        "createdAt": now,
        "updatedAt": now,
    })
    records = load_events()
    records.append(event)
    records.sort(key=lambda item: item.get("date", ""))
    save_events(records)
    return event


def update_event(event_id: str, payload: dict) -> dict:
    """Update an existing volunteer event."""
    if db_enabled():
        updated = update_volunteer_event(event_id, normalize_event(payload))
        if not updated:
            raise ValueError("Event not found")
        return updated
    records = load_events()
    matched = None
    for item in records:
        if item.get("id") == event_id:
            matched = item
            break
    if not matched:
        raise ValueError("Event not found")
    updated = normalize_event(payload)
    matched.update(updated)
    matched["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    records.sort(key=lambda item: item.get("date", ""))
    save_events(records)
    return matched


def delete_event(event_id: str) -> bool:
    """Delete a volunteer event."""
    if db_enabled():
        return delete_volunteer_event(event_id)
    records = load_events()
    remaining = [item for item in records if item.get("id") != event_id]
    if len(remaining) == len(records):
        return False
    save_events(remaining)
    return True
