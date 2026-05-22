"""entities router — list + read KNX entities via HAClient."""

from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app import deps
from app.main import build_app

from .conftest import FakeHAClient


@pytest.fixture
async def client(
    tmp_knx_dir: Path,
    tmp_path: Path,
    fake_ha_client: FakeHAClient,
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[AsyncClient]:
    deps.get_fs_adapter.cache_clear()
    deps.get_db.cache_clear()
    monkeypatch.setattr(deps, "get_knx_root", lambda: tmp_knx_dir)
    monkeypatch.setattr(deps, "get_data_dir", lambda: tmp_path)
    deps.set_ha_client(fake_ha_client)  # type: ignore[arg-type]
    fake_ha_client.results["config/entity_registry/list"] = [
        {"entity_id": "light.diele", "platform": "knx", "name": "Diele"},
        {"entity_id": "switch.steckdose", "platform": "knx", "name": "Steckdose"},
        {"entity_id": "light.fremd", "platform": "hue", "name": "Hue"},
    ]
    fake_ha_client.results["get_states"] = [
        {
            "entity_id": "light.diele",
            "state": "on",
            "attributes": {"friendly_name": "Diele", "brightness": 200},
            "last_changed": "2026-05-22T08:00:00+00:00",
        },
        {
            "entity_id": "sensor.aussentemp",
            "state": "23.5",
            "attributes": {
                "friendly_name": "Aussen",
                "unit_of_measurement": "°C",
            },
            "last_changed": "2026-05-22T08:05:00+00:00",
        },
    ]
    fake_ha_client.results["knx/get_entity_config"] = {
        "platform": "light",
        "data": {"entity": {"name": "Diele"}, "knx": {"ga_switch": {"write": "1/0/15"}}},
    }
    app = build_app(start_ha_client=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_list_entities_filters_to_knx_platform(client: AsyncClient) -> None:
    resp = await client.get("/api/entities")
    assert resp.status_code == 200
    body = resp.json()
    ids = sorted(e["entity_id"] for e in body["entities"])
    assert ids == ["light.diele", "switch.steckdose"]


@pytest.mark.asyncio
async def test_list_entities_enriches_with_state_and_unit(client: AsyncClient) -> None:
    resp = await client.get("/api/entities")
    assert resp.status_code == 200
    by_id = {e["entity_id"]: e for e in resp.json()["entities"]}
    diele = by_id["light.diele"]
    assert diele["state"] == "on"
    assert diele["last_changed"] == "2026-05-22T08:00:00+00:00"
    assert diele["unit_of_measurement"] is None
    # Steckdose has no get_states entry — should still surface, with state None.
    steckdose = by_id["switch.steckdose"]
    assert steckdose["state"] is None
    assert steckdose["unit_of_measurement"] is None


@pytest.mark.asyncio
async def test_get_one_entity_returns_config(client: AsyncClient) -> None:
    resp = await client.get("/api/entities/light.diele")
    assert resp.status_code == 200
    body = resp.json()
    assert body["entity_id"] == "light.diele"
    assert body["config"]["platform"] == "light"


@pytest.mark.asyncio
async def test_delete_entity_sends_knx_delete_and_returns_204(
    client: AsyncClient, fake_ha_client: FakeHAClient
) -> None:
    resp = await client.delete("/api/entities/light.diele")
    assert resp.status_code == 204
    assert resp.content == b""
    sent_types = [p["type"] for p in fake_ha_client.sent]
    assert "knx/delete_entity" in sent_types
    delete_payload = next(p for p in fake_ha_client.sent if p["type"] == "knx/delete_entity")
    assert delete_payload["entity_id"] == "light.diele"


@pytest.mark.asyncio
async def test_delete_entity_propagates_ha_error_as_502(
    client: AsyncClient, fake_ha_client: FakeHAClient
) -> None:
    fake_ha_client.errors["knx/delete_entity"] = "entity not in config_store"
    resp = await client.delete("/api/entities/light.missing")
    assert resp.status_code == 502
    assert "entity not in config_store" in resp.json()["detail"]
