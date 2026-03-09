"""FastAPI application factory and router registration."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import router as auth_router
from app.routers.public import router as public_router
from app.routers.volunteers import router as volunteers_router
from app.routers.gallery import router as gallery_router
from app.routers.map_admin import router as map_admin_router
from app.routers.updates import router as updates_router
from app.routers.contact import router as contact_router


def create_app() -> FastAPI:
    app = FastAPI(title="Te Waihora Trail API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(public_router)
    app.include_router(auth_router)
    app.include_router(volunteers_router)
    app.include_router(gallery_router)
    app.include_router(map_admin_router)
    app.include_router(updates_router)
    app.include_router(contact_router)
    return app


app = create_app()

