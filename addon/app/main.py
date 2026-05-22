"""FastAPI entry point. `build_app(start_ha_client=...)` lets tests skip the WS lifecycle."""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .adapters.ha_client import HAClient
from .deps import (
    get_db,
    get_ha_ws_url,
    get_supervisor_token,
    set_ha_client,
)
from .logging_config import configure_logging
from .routers import convert, entities, health, ws, yaml_io

log = logging.getLogger(__name__)

DEFAULT_WEB_DIR = Path("/app/web")


def _resolve_web_dir() -> Path | None:
    override = os.environ.get("KNX_WEB_DIR")
    candidates = [Path(override)] if override else []
    candidates.extend([DEFAULT_WEB_DIR, Path(__file__).parent.parent / "web" / "dist"])
    for c in candidates:
        if c.is_dir() and (c / "index.html").is_file():
            return c
    return None


def build_app(*, start_ha_client: bool = True, serve_web: bool = True) -> FastAPI:
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
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # Routers first so /api/* and /ws/* take precedence over the SPA fallback.
    app.include_router(health.router, prefix="/api")
    app.include_router(yaml_io.router)
    app.include_router(convert.router)
    app.include_router(entities.router)
    app.include_router(ws.router)

    @app.get("/api")
    async def api_root() -> dict[str, str]:
        return {"status": "ok", "service": "knx-yaml-to-ui"}

    # Frontend: mount Vite-built static assets + SPA fallback for client-side routing.
    if serve_web:
        web_dir = _resolve_web_dir()
        if web_dir is None:
            log.warning("No web dist found; UI will not be served")
        else:
            log.info("Serving frontend from %s", web_dir)
            assets_dir = web_dir / "assets"
            if assets_dir.is_dir():
                app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
            index_file = web_dir / "index.html"

            @app.get("/{full_path:path}", include_in_schema=False)
            async def spa_fallback(full_path: str, _request: Request) -> FileResponse:
                # Reserved prefixes already handled by routers above; this catches
                # client-side routes (/, /entities, /history, …) and asset misses.
                if full_path.startswith(("api/", "ws/")):
                    raise HTTPException(status_code=404)
                return FileResponse(index_file)

    return app


app = build_app()
