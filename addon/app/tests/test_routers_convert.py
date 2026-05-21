"""convert router — dry-run + commit for the light domain."""
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
    app = build_app(start_ha_client=False)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        await deps.get_db().init()
        yield c


@pytest.mark.asyncio
async def test_dry_run_returns_one_entry_for_light(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/convert/dry-run", json={"path": "light.yaml", "domain": "light"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["domain"] == "light"
    assert len(body["entries"]) == 1
    entry = body["entries"][0]
    assert entry["name"] == "Diele"
    assert entry["validation"] == "ok"
    assert entry["payload"]["platform"] == "light"


@pytest.mark.asyncio
async def test_commit_sends_create_entity_to_ha(
    client: AsyncClient, fake_ha_client: FakeHAClient
) -> None:
    resp = await client.post(
        "/api/convert/commit", json={"path": "light.yaml", "domain": "light"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["entries"][0]["entity_id"] == "light.diele"
    assert body["entries"][0]["applied"] is True
    types_sent = [m["type"] for m in fake_ha_client.sent]
    assert "knx/validate_entity" in types_sent
    assert "knx/create_entity" in types_sent


@pytest.mark.asyncio
async def test_commit_records_migration_row(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/convert/commit", json={"path": "light.yaml", "domain": "light"}
    )
    body = resp.json()
    rows = await deps.get_db().list_rows(limit=10)
    assert any(r["id"] == body["migration_id"] for r in rows)


@pytest.mark.asyncio
async def test_commit_continues_on_per_entity_error(
    client: AsyncClient, fake_ha_client: FakeHAClient
) -> None:
    fake_ha_client.errors["knx/create_entity"] = "boom from HA"
    resp = await client.post(
        "/api/convert/commit", json={"path": "light.yaml", "domain": "light"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["entries"][0]["applied"] is False
    assert "boom" in body["entries"][0]["error"]


@pytest.mark.asyncio
async def test_dry_run_unsupported_domain_returns_400(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/convert/dry-run", json={"path": "light.yaml", "domain": "climate"}
    )
    assert resp.status_code == 400
