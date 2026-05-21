"""ws router — forwards HA state_changed events filtered to KNX entities."""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import deps
from app.main import build_app

from .conftest import FakeHAClient


class StreamingFakeHAClient(FakeHAClient):
    def __init__(self) -> None:
        super().__init__()
        self.queued_events: list[dict[str, Any]] = []

    async def subscribe(
        self, payload: dict[str, Any]
    ) -> tuple[int, AsyncIterator[dict[str, Any]]]:
        events = list(self.queued_events)

        async def iterator() -> AsyncIterator[dict[str, Any]]:
            for e in events:
                yield e
            await asyncio.sleep(3600)  # keep ws alive after the seeded burst

        return 1, iterator()


@pytest.fixture
def streaming_client(
    tmp_knx_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Any:
    deps.get_fs_adapter.cache_clear()
    deps.get_db.cache_clear()
    monkeypatch.setattr(deps, "get_knx_root", lambda: tmp_knx_dir)
    monkeypatch.setattr(deps, "get_data_dir", lambda: tmp_path)
    fake = StreamingFakeHAClient()
    deps.set_ha_client(fake)  # type: ignore[arg-type]
    app = build_app(start_ha_client=False)
    with TestClient(app) as client:
        yield client, fake


def test_ws_stream_forwards_knx_state_changes(
    streaming_client: tuple[TestClient, StreamingFakeHAClient],
) -> None:
    client, fake = streaming_client
    fake.queued_events = [
        {
            "event_type": "state_changed",
            "data": {
                "entity_id": "light.diele",
                "new_state": {
                    "state": "on",
                    "attributes": {"brightness": 255},
                },
            },
        }
    ]
    with client.websocket_connect("/ws/state-stream") as ws:
        msg = json.loads(ws.receive_text())
        assert msg["entity_id"] == "light.diele"
        assert msg["state"] == "on"
        assert msg["attributes"] == {"brightness": 255}


def test_ws_stream_filters_non_knx_entities(
    streaming_client: tuple[TestClient, StreamingFakeHAClient],
) -> None:
    client, fake = streaming_client
    fake.queued_events = [
        {
            "event_type": "state_changed",
            "data": {
                "entity_id": "automation.bla",
                "new_state": {"state": "on"},
            },
        },
        {
            "event_type": "state_changed",
            "data": {
                "entity_id": "light.diele",
                "new_state": {"state": "off"},
            },
        },
    ]
    with client.websocket_connect("/ws/state-stream") as ws:
        msg = json.loads(ws.receive_text())
        assert msg["entity_id"] == "light.diele"
        assert msg["state"] == "off"
