"""FastAPI entry point for knx-yaml-to-ui HA Add-on."""

from fastapi import FastAPI

from app.routers import health

app = FastAPI(
    title="knx-yaml-to-ui",
    version="0.0.1",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.include_router(health.router, prefix="/api")


@app.get("/api")
async def root() -> dict[str, str]:
    return {"status": "ok", "service": "knx-yaml-to-ui"}
