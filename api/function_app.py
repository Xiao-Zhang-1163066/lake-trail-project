"""Azure Functions app for Te Waihora Trail."""

from typing import Any

import azure.functions as func
import requests

from config import SUPABASE_URL, SUPABASE_ANON_KEY
from utils import cors_headers, json_response, text_response, normalize_email
from auth import (
    get_current_user,
    issue_token,
    sanitize_user,
    verify_password,
    create_user,
    hash_password,
    get_current_admin,
)
from database import (
    find_user_by_email,
    list_project_updates,
    create_project_update,
    update_project_update,
    delete_project_update,
    get_project_update,
    update_user_profile,
    update_user_password,
)
from volunteers import (
    authorize_admin,
    load_volunteers,
    add_volunteer_entry,
    load_events,
    create_event,
    update_event,
    delete_event,
    list_volunteer_registrations_for_user,
    remove_volunteer_registration,
)
from gallery import (
    require_admin,
    gallery_list,
    add_gallery_entry,
    delete_gallery_entry,
    store_project_update_image,
    store_volunteer_event_image,
)
from map_data import fetch_public_pois, fetch_public_trails, MapDataError
from map_admin import (
    create_poi,
    update_poi,
    delete_poi,
    get_poi_by_id,
    create_trail,
    update_trail,
    delete_trail,
    get_trail_by_id,
    MapAdminError,
)
from contact import (
    submit_contact_form,
    subscribe_newsletter,
    unsubscribe_newsletter,
    list_contact_submissions,
    update_contact_submission_status,
    delete_contact_submission,
    list_newsletter_subscribers,
)


app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# --- Routes -----------------------------------------------------------------


@app.route(route="health", methods=["GET", "OPTIONS"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    return func.HttpResponse("OK", status_code=200, headers=cors_headers())


@app.route(route="auth/register", methods=["POST", "OPTIONS"])
def auth_register(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)

    email = normalize_email(payload.get("email"))
    if not email or "@" not in email:
        return text_response("A valid email is required", status=400)
    password = payload.get("password") or ""
    if len(password) < 8:
        return text_response("Password must be at least 8 characters", status=400)
    name = (payload.get("name") or "").strip()

    if find_user_by_email(email):
        return text_response("Email is already registered", status=409)

    try:
        record = create_user(email, password, name)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    except ValueError as exc:
        return text_response(str(exc), status=409)

    if not record:
        return text_response("Failed to create user", status=500)

    try:
        token = issue_token(record)
    except ValueError as exc:
        return text_response(str(exc), status=500)
    return json_response({"user": sanitize_user(record), "token": token}, status=201)


@app.route(route="auth/login", methods=["POST", "OPTIONS"])
def auth_login(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)

    email = normalize_email(payload.get("email"))
    password = payload.get("password") or ""
    if not email or not password:
        return text_response("Email and password are required", status=400)

    user = find_user_by_email(email)
    if not user or not verify_password(password, user.get("passwordHash", "")):
        return text_response("Invalid email or password", status=401)

    try:
        token = issue_token(user)
    except ValueError as exc:
        return text_response(str(exc), status=500)
    return json_response({"user": sanitize_user(user), "token": token})


@app.route(route="auth/me", methods=["GET", "OPTIONS"])
def auth_me(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    user, error = get_current_user(req, require=True)
    if error:
        return error
    return json_response({"user": sanitize_user(user)})


@app.route(route="auth/profile", methods=["PUT", "OPTIONS"])
def auth_profile_update(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    user, error = get_current_user(req, require=True)
    if error:
        return error
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    name = (payload.get("name") or "").strip()
    try:
        updated = update_user_profile(user.get("id"), name)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    if not updated:
        return text_response("User not found", status=404)
    return json_response({"user": sanitize_user(updated)})


@app.route(route="auth/password", methods=["PUT", "OPTIONS"])
def auth_change_password(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    user, error = get_current_user(req, require=True)
    if error:
        return error
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    current_password = (payload.get("currentPassword") or "").strip()
    new_password = (payload.get("newPassword") or "").strip()
    if len(new_password) < 8:
        return text_response("New password must be at least 8 characters", status=400)
    if not verify_password(current_password, user.get("passwordHash", "")):
        return text_response("Current password is incorrect", status=400)
    try:
        updated = update_user_password(user.get("id"), hash_password(new_password))
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    if not updated:
        return text_response("User not found", status=404)
    return json_response({"status": "updated"})


@app.route(route="public/trail", methods=["GET", "OPTIONS"])
def public_trail(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return text_response("Supabase env not set", status=500)
    try:
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/public_trail_sections_view?select=*",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        return text_response(str(exc), status=502)
    return func.HttpResponse(
        res.text,
        status_code=res.status_code,
        mimetype="application/json",
        headers=cors_headers(),
    )


@app.route(route="public/trails", methods=["GET", "OPTIONS"])
def public_trails(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    try:
        payload = fetch_public_trails()
    except MapDataError as exc:
        return text_response(str(exc), status=503)
    except Exception:  # pragma: no cover - defensive fallback
        return text_response("Failed to load trail data", status=503)
    return json_response(payload)


@app.route(route="public/pois", methods=["GET", "OPTIONS"])
def public_pois(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    cat = (req.params.get("cat") or "").strip() or None
    try:
        payload = fetch_public_pois(category=cat)
    except MapDataError as exc:
        return text_response(str(exc), status=503)
    except Exception:  # pragma: no cover - defensive fallback
        return text_response("Failed to load POI data", status=503)
    return json_response(payload)


@app.route(route="volunteers/register", methods=["POST", "OPTIONS"])
def volunteers_register(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    current_user, _ = get_current_user(req, require=False)
    try:
        entry = add_volunteer_entry(payload, current_user=current_user)
    except ValueError as exc:
        return text_response(str(exc), status=400)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    return json_response({"status": "received", "entry": entry}, status=201)


@app.route(route="volunteers/admin/list", methods=["GET", "OPTIONS"])
def volunteers_admin_list(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    auth = authorize_admin(req)
    if auth:
        return auth
    try:
        items = load_volunteers()
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    return json_response({"items": items})


@app.route(route="volunteers/events", methods=["GET", "OPTIONS"])
def volunteers_events(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    try:
        items = load_events()
    except RuntimeError as exc:
        return text_response(str(exc), status=503)
    items.sort(key=lambda item: item.get("date", ""))
    return json_response({"items": items})


@app.route(route="volunteers/me/registrations", methods=["GET", "OPTIONS"])
def volunteers_my_registrations(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    user, error = get_current_user(req, require=True)
    if error:
        return error
    try:
        items = list_volunteer_registrations_for_user(
            user.get("id") or "", user.get("email") or ""
        )
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    return json_response({"items": items})


@app.route(
    route="volunteers/me/registrations/{registration_id}",
    methods=["DELETE", "OPTIONS"],
)
def volunteers_my_registration_detail(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    user, error = get_current_user(req, require=True)
    if error:
        return error
    registration_id = req.route_params.get("registration_id")
    if not registration_id:
        return text_response("Missing registration id", status=400)
    try:
        removed = remove_volunteer_registration(
            registration_id, user.get('id') or '', user.get('email') or ''
        )
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    if not removed:
        return text_response("Registration not found", status=404)
    return json_response({"status": "deleted", "id": registration_id})


@app.route(route="volunteers/admin/events", methods=["GET", "POST", "OPTIONS"])
def volunteers_admin_events(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    auth = authorize_admin(req)
    if auth:
        return auth
    if req.method == "GET":
        try:
            items = load_events()
        except RuntimeError as exc:
            return text_response(str(exc), status=500)
        items.sort(key=lambda item: item.get("date", ""))
        return json_response({"items": items})
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    try:
        event = create_event(payload)
    except ValueError as exc:
        return text_response(str(exc), status=400)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    return json_response({"event": event}, status=201)


@app.route(route="volunteers/admin/events/upload-image", methods=["POST", "OPTIONS"])
def volunteers_admin_events_upload_image(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    auth = authorize_admin(req)
    if auth:
        return auth
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    try:
        asset = store_volunteer_event_image(payload)
    except ValueError as exc:
        return text_response(str(exc), status=400)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    return json_response({"asset": asset}, status=201)


@app.route(route="volunteers/admin/events/{event_id}", methods=["PUT", "DELETE", "OPTIONS"])
def volunteers_admin_event_detail(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    auth = authorize_admin(req)
    if auth:
        return auth
    event_id = req.route_params.get("event_id")
    if not event_id:
        return text_response("Missing event id", status=400)
    if req.method == "DELETE":
        try:
            removed = delete_event(event_id)
        except RuntimeError as exc:
            return text_response(str(exc), status=500)
        if not removed:
            return text_response("Event not found", status=404)
        return json_response({"status": "deleted", "id": event_id})
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    try:
        event = update_event(event_id, payload)
    except ValueError as exc:
        return text_response(str(exc), status=404)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    return json_response({"event": event})


@app.route(route="gallery/public/list", methods=["GET", "OPTIONS"])
def gallery_public_list(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    try:
        items = gallery_list(include_unapproved=True)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    return json_response({"items": items})


@app.route(route="gallery/public/upload", methods=["POST", "OPTIONS"])
def gallery_public_upload(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    return text_response(
        "Public uploads are disabled. Please contact the site administrators.",
        status=403,
    )


@app.route(route="gallery/admin/list", methods=["GET", "OPTIONS"])
def gallery_admin_list(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    if not require_admin(req):
        return text_response("Unauthorized", status=401)
    try:
        items = gallery_list(include_unapproved=True)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    return json_response({"items": items})


@app.route(route="gallery/admin/upload", methods=["POST", "OPTIONS"])
def gallery_admin_upload(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    if not require_admin(req):
        return text_response("Unauthorized", status=401)
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    try:
        entry = add_gallery_entry(payload, source="admin")
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    except ValueError as exc:
        return text_response(str(exc), status=400)
    return json_response({"item": entry}, status=201)


@app.route(route="gallery/admin/{item_id}", methods=["DELETE", "OPTIONS"])
def gallery_admin_delete(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    if not require_admin(req):
        return text_response("Unauthorized", status=401)
    item_id = req.route_params.get("item_id")
    if not item_id:
        return text_response("Missing item id", status=400)
    try:
        removed = delete_gallery_entry(item_id)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    if not removed:
        return text_response("Item not found", status=404)
    return json_response({"status": "deleted", "id": item_id})


# --- Map Admin Routes -------------------------------------------------------


@app.route(route="map/admin/pois", methods=["POST", "OPTIONS"])
def map_admin_pois_create(req: func.HttpRequest) -> func.HttpResponse:
    """Create a new POI."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    if not require_admin(req):
        return text_response("Unauthorized", status=401)
    
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    
    # Validate required fields
    category_id = payload.get("category_id")
    name = payload.get("name")
    lat = payload.get("lat")
    lng = payload.get("lng")
    
    if not category_id:
        return text_response("Missing category_id", status=400)
    if not name:
        return text_response("Missing name", status=400)
    if lat is None:
        return text_response("Missing lat", status=400)
    if lng is None:
        return text_response("Missing lng", status=400)
    
    try:
        category_id = int(category_id)
        lat = float(lat)
        lng = float(lng)
    except (ValueError, TypeError):
        return text_response("Invalid data types", status=400)
    
    # Optional fields
    description = payload.get("description")
    image_url = payload.get("image_url")
    gmaps_url = payload.get("gmaps_url")
    is_public = payload.get("is_public", True)
    sort_index = payload.get("sort_index", 0)
    
    try:
        poi = create_poi(
            category_id=category_id,
            name=name,
            lat=lat,
            lng=lng,
            description=description,
            image_url=image_url,
            gmaps_url=gmaps_url,
            is_public=is_public,
            sort_index=sort_index,
        )
        return json_response({"poi": poi}, status=201)
    except MapAdminError as exc:
        return text_response(str(exc), status=400)
    except Exception as exc:
        return text_response(f"Internal error: {exc}", status=500)


@app.route(route="map/admin/pois/{poi_id}", methods=["GET", "PUT", "DELETE", "OPTIONS"])
def map_admin_pois_by_id(req: func.HttpRequest) -> func.HttpResponse:
    """Get, update, or delete a POI by ID."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    if not require_admin(req):
        return text_response("Unauthorized", status=401)
    
    poi_id_str = req.route_params.get("poi_id")
    if not poi_id_str:
        return text_response("Missing poi_id", status=400)
    
    try:
        poi_id = int(poi_id_str)
    except ValueError:
        return text_response("Invalid poi_id", status=400)
    
    # GET: Retrieve POI
    if req.method == "GET":
        try:
            poi = get_poi_by_id(poi_id)
            if not poi:
                return text_response("POI not found", status=404)
            return json_response({"poi": poi})
        except Exception as exc:
            return text_response(f"Internal error: {exc}", status=500)
    
    # PUT: Update POI
    elif req.method == "PUT":
        try:
            payload = req.get_json()
        except ValueError:
            return text_response("Invalid JSON payload", status=400)
        
        # Build kwargs for update
        kwargs = {}
        
        if "category_id" in payload:
            try:
                kwargs["category_id"] = int(payload["category_id"])
            except (ValueError, TypeError):
                return text_response("Invalid category_id", status=400)
        
        if "name" in payload:
            kwargs["name"] = payload["name"]
        
        if "lat" in payload:
            try:
                kwargs["lat"] = float(payload["lat"])
            except (ValueError, TypeError):
                return text_response("Invalid lat", status=400)
        
        if "lng" in payload:
            try:
                kwargs["lng"] = float(payload["lng"])
            except (ValueError, TypeError):
                return text_response("Invalid lng", status=400)
        
        if "description" in payload:
            kwargs["description"] = payload["description"]
        
        if "image_url" in payload:
            kwargs["image_url"] = payload["image_url"]
        
        if "gmaps_url" in payload:
            kwargs["gmaps_url"] = payload["gmaps_url"]
        
        if "is_public" in payload:
            kwargs["is_public"] = bool(payload["is_public"])
        
        if "sort_index" in payload:
            try:
                kwargs["sort_index"] = int(payload["sort_index"])
            except (ValueError, TypeError):
                return text_response("Invalid sort_index", status=400)
        
        try:
            poi = update_poi(poi_id, **kwargs)
            return json_response({"poi": poi})
        except MapAdminError as exc:
            return text_response(str(exc), status=400)
        except Exception as exc:
            return text_response(f"Internal error: {exc}", status=500)
    
    # DELETE: Delete POI
    elif req.method == "DELETE":
        try:
            result = delete_poi(poi_id)
            return json_response(result)
        except MapAdminError as exc:
            return text_response(str(exc), status=404)
        except Exception as exc:
            return text_response(f"Internal error: {exc}", status=500)


@app.route(route="map/admin/trails", methods=["POST", "OPTIONS"])
def map_admin_trails_create(req: func.HttpRequest) -> func.HttpResponse:
    """Create a new trail segment."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    if not require_admin(req):
        return text_response("Unauthorized", status=401)
    
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    
    # Validate required fields
    name = payload.get("name")
    geojson = payload.get("geojson")
    
    if not name:
        return text_response("Missing name", status=400)
    if not geojson:
        return text_response("Missing geojson", status=400)
    
    # Optional fields
    status = payload.get("status")
    description = payload.get("description")
    legend_label = payload.get("legend_label")
    is_public = payload.get("is_public", True)
    sort_index = payload.get("sort_index", 0)

    if not status:
        return text_response("Missing status", status=400)

    try:
        trail = create_trail(
            name=name,
            geojson=geojson,
            status=status,
            description=description,
            legend_label=legend_label,
            is_public=is_public,
            sort_index=sort_index,
        )
        return json_response({"trail": trail}, status=201)
    except MapAdminError as exc:
        return text_response(str(exc), status=400)
    except Exception as exc:
        return text_response(f"Internal error: {exc}", status=500)


@app.route(route="map/admin/trails/{trail_id}", methods=["GET", "PUT", "DELETE", "OPTIONS"])
def map_admin_trails_by_id(req: func.HttpRequest) -> func.HttpResponse:
    """Get, update, or delete a trail segment by ID."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    if not require_admin(req):
        return text_response("Unauthorized", status=401)

    trail_id_str = req.route_params.get("trail_id")
    if not trail_id_str:
        return text_response("Missing trail_id", status=400)

    try:
        trail_id = int(trail_id_str)
    except ValueError:
        return text_response("Invalid trail_id", status=400)

    if req.method == "GET":
        try:
            trail = get_trail_by_id(trail_id)
            if not trail:
                return text_response("Trail not found", status=404)
            return json_response({"trail": trail})
        except Exception as exc:
            return text_response(f"Internal error: {exc}", status=500)

    if req.method == "PUT":
        try:
            payload = req.get_json()
        except ValueError:
            return text_response("Invalid JSON payload", status=400)

        if not isinstance(payload, dict):
            return text_response("Invalid payload", status=400)

        kwargs: dict[str, Any] = {}

        if "name" in payload:
            kwargs["name"] = payload["name"]

        if "status" in payload:
            kwargs["status"] = payload["status"]

        if "description" in payload:
            kwargs["description"] = payload["description"]

        if "legend_label" in payload:
            kwargs["legend_label"] = payload["legend_label"]

        if "is_public" in payload:
            kwargs["is_public"] = bool(payload["is_public"])

        if "sort_index" in payload:
            try:
                kwargs["sort_index"] = int(payload["sort_index"])
            except (ValueError, TypeError):
                return text_response("Invalid sort_index", status=400)

        if "geojson" in payload:
            kwargs["geojson"] = payload["geojson"]

        try:
            trail = update_trail(trail_id, **kwargs)
            return json_response({"trail": trail})
        except MapAdminError as exc:
            return text_response(str(exc), status=400)
        except Exception as exc:
            return text_response(f"Internal error: {exc}", status=500)

    if req.method == "DELETE":
        try:
            result = delete_trail(trail_id)
            return json_response(result)
        except MapAdminError as exc:
            return text_response(str(exc), status=404)
        except Exception as exc:
            return text_response(f"Internal error: {exc}", status=500)

    return text_response("Method not allowed", status=405)


# Project updates -------------------------------------------------------------


def _parse_bool(value, default=None):
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


@app.route(route="public/updates", methods=["GET", "OPTIONS"])
def updates_public_list(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    try:
        items = list_project_updates(include_unpublished=False)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    return json_response({"items": items})


@app.route(route="public/updates/{update_id}", methods=["GET", "OPTIONS"])
def updates_public_detail(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    update_id = req.route_params.get("update_id")
    if not update_id:
        return text_response("Missing update id", status=400)
    try:
        item = get_project_update(update_id)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    if not item or not item.get("isPublished"):
        return text_response("Update not found", status=404)
    return json_response({"item": item})


@app.route(route="updates/admin", methods=["GET", "POST", "OPTIONS"])
def updates_admin_collection(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    _, error = get_current_admin(req, require=True)
    if error:
        return error
    if req.method == "GET":
        try:
            items = list_project_updates(include_unpublished=True)
        except RuntimeError as exc:
            return text_response(str(exc), status=500)
        return json_response({"items": items})
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)

    title = (payload.get("title") or "").strip()
    if not title:
        return text_response("Title is required", status=400)
    summary = (payload.get("summary") or "").strip()
    detail = (payload.get("detail") or "").strip()
    category = (payload.get("category") or "").strip()
    image_url = (payload.get("imageUrl") or "").strip()
    link_url = (payload.get("linkUrl") or "").strip()
    is_published = _parse_bool(payload.get("isPublished"), default=True)
    try:
        item = create_project_update(
            title=title,
            summary=summary,
            detail=detail,
            category=category,
            image_url=image_url,
            link_url=link_url,
            is_published=is_published,
        )
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    return json_response({"item": item}, status=201)


@app.route(route="updates/admin/upload-image", methods=["POST", "OPTIONS"])
def updates_admin_upload_image(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    _, error = get_current_admin(req, require=True)
    if error:
        return error
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    try:
        asset = store_project_update_image(payload)
    except ValueError as exc:
        return text_response(str(exc), status=400)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    return json_response({"asset": asset}, status=201)


@app.route(route="updates/admin/{update_id}", methods=["PUT", "DELETE", "OPTIONS"])
def updates_admin_detail(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    _, error = get_current_admin(req, require=True)
    if error:
        return error
    update_id = req.route_params.get("update_id")
    if not update_id:
        return text_response("Missing update id", status=400)

    if req.method == "DELETE":
        try:
            removed = delete_project_update(update_id)
        except RuntimeError as exc:
            return text_response(str(exc), status=500)
        if not removed:
            return text_response("Update not found", status=404)
        return json_response({"status": "deleted", "id": update_id})

    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)

    kwargs = {}
    if "title" in payload:
        kwargs["title"] = (payload.get("title") or "").strip()
    if "summary" in payload:
        kwargs["summary"] = (payload.get("summary") or "").strip()
    if "detail" in payload:
        kwargs["detail"] = (payload.get("detail") or "").strip()
    if "category" in payload:
        kwargs["category"] = (payload.get("category") or "").strip()
    if "imageUrl" in payload:
        kwargs["image_url"] = (payload.get("imageUrl") or "").strip()
    if "linkUrl" in payload:
        value = (payload.get("linkUrl") or "").strip()
        kwargs["link_url"] = value or None
    if "isPublished" in payload:
        kwargs["is_published"] = _parse_bool(payload.get("isPublished"))

    try:
        item = update_project_update(update_id, **kwargs)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    if not item:
        return text_response("Update not found", status=404)
    return json_response({"item": item})


# --- Contact & Newsletter Routes --------------------------------------------


@app.route(route="contact/submit", methods=["POST", "OPTIONS"])
def contact_submit(req: func.HttpRequest) -> func.HttpResponse:
    """Submit a contact form."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    
    name = (payload.get("name") or "").strip()
    email = normalize_email(payload.get("email"))
    message = (payload.get("message") or "").strip()
    
    if not name:
        return text_response("Name is required", status=400)
    if not email or "@" not in email:
        return text_response("A valid email is required", status=400)
    if not message:
        return text_response("Message is required", status=400)
    
    try:
        submission = submit_contact_form(name, email, message)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    
    return json_response({
        "ok": True,
        "message": "Your message has been sent successfully! We'll get back to you soon.",
        "submission": submission
    }, status=201)


@app.route(route="newsletter/subscribe", methods=["POST", "OPTIONS"])
def newsletter_subscribe(req: func.HttpRequest) -> func.HttpResponse:
    """Subscribe to newsletter."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    
    email = normalize_email(payload.get("email"))
    name = (payload.get("name") or "").strip() or None
    
    if not email or "@" not in email:
        return text_response("A valid email is required", status=400)
    
    try:
        subscription = subscribe_newsletter(email, name)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    
    return json_response({
        "ok": True,
        "message": "Successfully subscribed to newsletter!",
        "subscription": subscription
    }, status=201)


@app.route(route="newsletter/unsubscribe", methods=["POST", "OPTIONS"])
def newsletter_unsubscribe_route(req: func.HttpRequest) -> func.HttpResponse:
    """Unsubscribe from newsletter."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    
    try:
        payload = req.get_json()
    except ValueError:
        return text_response("Invalid JSON payload", status=400)
    
    email = normalize_email(payload.get("email"))
    
    if not email or "@" not in email:
        return text_response("A valid email is required", status=400)
    
    try:
        subscription = unsubscribe_newsletter(email)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    
    return json_response({
        "ok": True,
        "message": "Successfully unsubscribed from newsletter.",
        "subscription": subscription
    })


@app.route(route="contact/admin/submissions", methods=["GET", "OPTIONS"])
def contact_admin_submissions(req: func.HttpRequest) -> func.HttpResponse:
    """List all contact form submissions (admin only)."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    
    _, error = get_current_admin(req, require=True)
    if error:
        return error
    
    status = req.params.get("status")
    limit = int(req.params.get("limit", "50"))
    
    try:
        submissions = list_contact_submissions(status=status, limit=limit)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    
    return json_response({"submissions": submissions})


@app.route(route="contact/admin/submissions/{submission_id}", methods=["PATCH", "DELETE", "OPTIONS"])
def contact_admin_submission_actions(req: func.HttpRequest) -> func.HttpResponse:
    """Update or delete contact submission (admin only)."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    
    _, error = get_current_admin(req, require=True)
    if error:
        return error
    
    submission_id = req.route_params.get("submission_id")
    if not submission_id:
        return text_response("Missing submission id", status=400)
    
    # Handle DELETE request
    if req.method == "DELETE":
        try:
            delete_contact_submission(submission_id)
        except RuntimeError as exc:
            return text_response(str(exc), status=404)
        
        return json_response({"message": "Submission deleted successfully"})
    
    # Handle PATCH request
    if req.method == "PATCH":
        try:
            payload = req.get_json()
        except ValueError:
            return text_response("Invalid JSON payload", status=400)
        
        status = payload.get("status")
        if not status or status not in ["new", "read", "responded", "archived"]:
            return text_response("Invalid status value", status=400)
        
        try:
            submission = update_contact_submission_status(submission_id, status)
        except RuntimeError as exc:
            return text_response(str(exc), status=500)
        
        return json_response({"submission": submission})
    
    return text_response("Method not allowed", status=405)


@app.route(route="newsletter/admin/subscribers", methods=["GET", "OPTIONS"])
def newsletter_admin_subscribers(req: func.HttpRequest) -> func.HttpResponse:
    """List newsletter subscribers (admin only)."""
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=cors_headers())
    
    _, error = get_current_admin(req, require=True)
    if error:
        return error
    
    # active 参数: "true" = 只显示活跃, "false" = 只显示未订阅, 不传或"all" = 显示所有
    active_param = req.params.get("active", "").lower()
    limit = int(req.params.get("limit", "1000"))
    
    try:
        if active_param == "true":
            subscribers = list_newsletter_subscribers(active_only=True, limit=limit)
        elif active_param == "false":
            subscribers = list_newsletter_subscribers(active_only=False, limit=limit)
        else:
            # 获取所有订阅者
            subscribers = list_newsletter_subscribers(active_only=None, limit=limit)
    except RuntimeError as exc:
        return text_response(str(exc), status=500)
    
    return json_response({"subscribers": subscribers})
