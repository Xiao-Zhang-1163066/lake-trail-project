# API Architecture Convention

This backend uses a layered FastAPI structure hosted on Azure Functions.

## Layers

- `app/routers/*`
  - HTTP layer only.
  - Responsibilities: parse request, run auth guard, call service, return response.
  - No SQL and no complex domain logic.

- `services/*`
  - Business orchestration layer.
  - Responsibilities: validation rules, workflow sequencing, error mapping.
  - Raises `services.errors.AppError` for API-facing failures.

- `repositories/*`
  - Data access layer.
  - Responsibilities: DB connection, SQL, row mapping.
  - No HTTP objects.

- `function_app.py`
  - Azure Functions entrypoint.
  - Forwards all HTTP traffic to FastAPI via ASGI middleware.

## Import Rules

- Routers can import: `services/*`, auth helpers, response helpers.
- Services can import: `repositories/*`, other domain modules.
- Repositories can import: `config`, `utils` and DB drivers.
- Repositories must not import routers/services.

## Error Rules

- Service-layer validation/business errors should be `AppError(message, status_code)`.
- Router catches `AppError` and converts it to HTTP response.
- Unexpected exceptions are handled conservatively at service or router boundary.

## Naming

- Route files: `<domain>.py` in `app/routers`.
- Service files: `<domain>_service.py`.
- Repository files: `<domain>.py`.
- Keep function names verb-first: `create_*`, `update_*`, `list_*`, `delete_*`, `get_*`.

