"""HAClient against a fake WS server backed by websockets.serve.

The fake server speaks the HA-WS handshake (auth_required → auth_ok) and
echoes structured replies. Lets us exercise reconnect, send/recv correlation,
and timeout behavior without needing a real HA.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

import pytest
from websockets.asyncio.server import ServerConnection, serve

from app.adapters.ha_client import HAClient, HAClientError


class FakeHA:
    """Minimal HA-WS server for tests."""

    def __init__(self) -> None:
        self.received: list[dict[str, Any]] = []
        self.next_results: dict[int, dict[str, Any]] = {}
        self.events_after_subscribe: list[dict[str, Any]] = []

    async def handler(self, ws: ServerConnection) -> None:
        await ws.send(json.dumps({"type": "auth_required", "ha_version": "2026.5.0"}))
        try:
            raw = await ws.recv()
        except Exception:
            return
        auth_msg = json.loads(raw)
        if auth_msg.get("type") != "auth" or not auth_msg.get("access_token"):
            await ws.send(json.dumps({"type": "auth_invalid"}))
            await ws.close()
            return
        await ws.send(json.dumps({"type": "auth_ok", "ha_version": "2026.5.0"}))

        async for raw in ws:
            msg = json.loads(raw)
            self.received.append(msg)
            mid = msg["id"]
            result = self.next_results.get(mid) or {
                "id": mid,
                "type": "result",
                "success": True,
                "result": {"ok": True},
            }
            await ws.send(json.dumps(result))
            if msg.get("type", "").startswith("subscribe"):
                for evt in self.events_after_subscribe:
                    await ws.send(json.dumps({"id": mid, "type": "event", "event": evt}))


@pytest.fixture
async def fake_ha() -> AsyncIterator[tuple[FakeHA, str]]:
    fake = FakeHA()
    async with serve(fake.handler, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]
        yield fake, f"ws://127.0.0.1:{port}"


@pytest.mark.asyncio
async def test_connect_and_send_command(fake_ha: tuple[FakeHA, str]) -> None:
    fake, url = fake_ha
    client = HAClient(url=url, token="dev")
    await client.connect()
    result = await client.send({"type": "knx/get_base_data"})
    assert result == {"ok": True}
    assert fake.received[0]["type"] == "knx/get_base_data"
    await client.close()


@pytest.mark.asyncio
async def test_send_returns_error_on_unsuccessful_result(fake_ha: tuple[FakeHA, str]) -> None:
    fake, url = fake_ha
    fake.next_results[1] = {
        "id": 1,
        "type": "result",
        "success": False,
        "error": {"code": "invalid_format", "message": "boom"},
    }
    client = HAClient(url=url, token="dev")
    await client.connect()
    with pytest.raises(HAClientError) as exc:
        await client.send({"type": "knx/get_base_data"})
    assert "boom" in str(exc.value)
    await client.close()


@pytest.mark.asyncio
async def test_send_correlates_concurrent_requests(fake_ha: tuple[FakeHA, str]) -> None:
    fake, url = fake_ha
    fake.next_results[1] = {"id": 1, "type": "result", "success": True, "result": {"a": 1}}
    fake.next_results[2] = {"id": 2, "type": "result", "success": True, "result": {"b": 2}}
    client = HAClient(url=url, token="dev")
    await client.connect()
    a, b = await asyncio.gather(
        client.send({"type": "knx/foo"}),
        client.send({"type": "knx/bar"}),
    )
    assert {a["a"], b["b"]} == {1, 2}
    await client.close()


@pytest.mark.asyncio
async def test_invalid_token_raises(fake_ha: tuple[FakeHA, str]) -> None:
    _, url = fake_ha
    client = HAClient(url=url, token="")
    with pytest.raises(HAClientError):
        await client.connect()


@pytest.mark.asyncio
async def test_subscribe_yields_events(fake_ha: tuple[FakeHA, str]) -> None:
    fake, url = fake_ha
    fake.events_after_subscribe = [
        {"event_type": "state_changed", "data": {"entity_id": "light.diele"}},
        {"event_type": "state_changed", "data": {"entity_id": "light.kueche"}},
    ]
    client = HAClient(url=url, token="dev")
    await client.connect()
    _sub_id, events = await client.subscribe({"type": "subscribe_events"})
    first = await asyncio.wait_for(events.__anext__(), timeout=2.0)
    second = await asyncio.wait_for(events.__anext__(), timeout=2.0)
    assert first["data"]["entity_id"] == "light.diele"
    assert second["data"]["entity_id"] == "light.kueche"
    await client.close()


@pytest.mark.asyncio
async def test_send_without_connect_raises() -> None:
    client = HAClient(url="ws://unused", token="x")
    with pytest.raises(HAClientError):
        await client.send({"type": "knx/get_base_data"})
