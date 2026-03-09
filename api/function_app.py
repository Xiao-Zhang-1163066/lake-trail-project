"""Azure Functions entrypoint for FastAPI (ASGI), compatible with older SDKs."""

import azure.functions as func

from fastapi_app import app as fastapi_app


app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


class _ApiPrefixStripper:
    """Strip Azure Functions default '/api' prefix before handing to FastAPI."""

    def __init__(self, asgi_app):
        self._app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            path = scope.get("path", "") or ""
            if path == "/api":
                scope = dict(scope)
                scope["path"] = "/"
            elif path.startswith("/api/"):
                scope = dict(scope)
                scope["path"] = path[4:] or "/"
        await self._app(scope, receive, send)


_asgi_app = _ApiPrefixStripper(fastapi_app)


@app.route(route="{*route}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def http_app_func(req: func.HttpRequest, context: func.Context) -> func.HttpResponse:
    """Dispatch all HTTP traffic to the FastAPI ASGI app."""
    return await func.AsgiMiddleware(_asgi_app).handle_async(req, context)
