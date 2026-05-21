"""Browser-facing WebSocket — proxies filtered HA state_changed events."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..deps import get_ha_client

log = logging.getLogger(__name__)
router = APIRouter()

_KNX_PLATFORMS = {
    "light",
    "switch",
    "cover",
    "binary_sensor",
    "sensor",
    "climate",
    "time",
    "datetime",
}


def _is_knx_state_event(event: dict[str, Any]) -> bool:
    if event.get("event_type") != "state_changed":
        return False
    entity_id = event.get("data", {}).get("entity_id", "")
    return entity_id.split(".", 1)[0] in _KNX_PLATFORMS


@router.websocket("/ws/state-stream")
async def state_stream(ws: WebSocket) -> None:
    await ws.accept()
    ha = get_ha_client()
    try:
        _, events = await ha.subscribe(
            {"type": "subscribe_events", "event_type": "state_changed"}
        )
        async for event in events:
            if not _is_knx_state_event(event):
                continue
            data = event["data"]
            new_state = data.get("new_state") or {}
            await ws.send_json(
                {
                    "entity_id": data.get("entity_id"),
                    "state": new_state.get("state"),
                    "attributes": new_state.get("attributes", {}),
                }
            )
    except WebSocketDisconnect:
        log.info("ws/state-stream client disconnected")
    except Exception:
        log.exception("ws/state-stream crashed")
        await ws.close(code=1011)
