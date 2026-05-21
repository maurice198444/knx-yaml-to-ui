"""FastAPI entry point. `build_app(start_ha_client=...)` lets tests skip the WS lifecycle."""
from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .adapters.ha_client import HAClient
from .deps import (
    get_db,
    get_ha_ws_url,
    get_supervisor_token,
    set_ha_client,
)
from .logging_config import configure_logging
from .routers import convert, entities, health, yaml_io


def build_app(*, start_ha_client: bool = True) -> FastAPI:
    configure_logging()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        db = get_db()
        await db.init()
        if start_ha_client:
            client = HAClient(url=get_ha_ws_url(), token=get_supervisor_token())
            await client.connect()
            set_ha_client(client)
            try:
                yield
            finally:
                await client.close()
        else:
            yield

    app = FastAPI(
        title="knx-yaml-to-ui",
        version="0.0.2",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.include_router(health.router, prefix="/api")
    app.include_router(yaml_io.router)
    app.include_router(convert.router)
    app.include_router(entities.router)

    @app.get("/api")
    async def root() -> dict[str, str]:
        return {"status": "ok", "service": "knx-yaml-to-ui"}

    return app


app = build_app()
