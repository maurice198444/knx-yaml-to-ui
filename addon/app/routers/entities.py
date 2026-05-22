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
    registry = await ha.send({"type": "config/entity_registry/list"})
    raw_entries = registry if isinstance(registry, list) else registry.get("entities", [])
    knx_entries = [e for e in raw_entries if e.get("platform") == "knx"]

    # Enrich with current state + unit + last_changed (one extra WS call).
    states_result = await ha.send({"type": "get_states"})
    raw_states = states_result if isinstance(states_result, list) else []
    state_by_id = {s["entity_id"]: s for s in raw_states if "entity_id" in s}

    entries = []
    for e in knx_entries:
        eid = e["entity_id"]
        st = state_by_id.get(eid, {})
        attrs = st.get("attributes") or {}
        entries.append(
            EntitySummary(
                entity_id=eid,
                name=e.get("name") or attrs.get("friendly_name"),
                platform=e.get("platform", ""),
                state=st.get("state"),
                unit_of_measurement=attrs.get("unit_of_measurement"),
                last_changed=st.get("last_changed"),
            )
        )
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
