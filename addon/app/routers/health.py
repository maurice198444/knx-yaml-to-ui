"""Health + version endpoints."""

import os

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/version")
async def version() -> dict[str, str]:
    return {
        "addon_version": os.environ.get("ADDON_VERSION", "dev"),
        "core_version": "0.1.0",
    }
