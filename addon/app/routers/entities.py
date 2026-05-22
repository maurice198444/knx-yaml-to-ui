"""Entities router — list, read, delete KNX entities."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from ..adapters.ha_client import HAClient, HAClientError
from ..deps import get_ha_client
from ..schemas import EntitiesResponse, EntityConfigResponse, EntitySummary

router = APIRouter(prefix="/api/entities", tags=["entities"])

HaDep = Annotated[HAClient, Depends(get_ha_client)]


@router.get("", response_model=EntitiesResponse)
async def list_entities(ha: HaDep) -> EntitiesResponse:
    result = await ha.send({"type": "config/entity_registry/list"})
    raw_entries = result if isinstance(result, list) else result.get("entities", [])
    entries = [
        EntitySummary(
            entity_id=e["entity_id"],
            name=e.get("name"),
            platform=e.get("platform", ""),
            state=None,
        )
        for e in raw_entries
        if e.get("platform") == "knx"
    ]
    return EntitiesResponse(entities=entries)


@router.get("/{entity_id}", response_model=EntityConfigResponse)
async def get_entity(entity_id: str, ha: HaDep) -> EntityConfigResponse:
    config = await ha.send({"type": "knx/get_entity_config", "entity_id": entity_id})
    return EntityConfigResponse(entity_id=entity_id, config=config)


@router.delete("/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entity(entity_id: str, ha: HaDep) -> None:
    try:
        await ha.send({"type": "knx/delete_entity", "entity_id": entity_id})
    except HAClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
