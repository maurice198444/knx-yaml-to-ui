"""yaml_io router — list and parse YAML files under /config/knx."""
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app import deps
from app.main import build_app


@pytest.fixture
async def client(
    tmp_knx_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[AsyncClient]:
    deps.get_fs_adapter.cache_clear()
    deps.get_db.cache_clear()
    monkeypatch.setattr(deps, "get_knx_root", lambda: tmp_knx_dir)
    monkeypatch.setattr(deps, "get_data_dir", lambda: tmp_knx_dir.parent)
    app = build_app(start_ha_client=False)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.mark.asyncio
async def test_list_yaml_files(client: AsyncClient) -> None:
    resp = await client.get("/api/yaml/files")
    assert resp.status_code == 200
    body = resp.json()
    names = sorted(f["name"] for f in body["files"])
    assert names == ["light.yaml", "switch.yaml"]


@pytest.mark.asyncio
async def test_parse_yaml_returns_domain_summary(client: AsyncClient) -> None:
    resp = await client.get("/api/yaml/parse", params={"path": "light.yaml"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["path"] == "light.yaml"
    assert len(body["domains"]) == 1
    assert body["domains"][0]["domain"] == "light"
    assert body["domains"][0]["entity_names"] == ["Diele"]


@pytest.mark.asyncio
async def test_parse_missing_file_returns_404(client: AsyncClient) -> None:
    resp = await client.get("/api/yaml/parse", params={"path": "nope.yaml"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_parse_rejects_path_traversal(client: AsyncClient) -> None:
    resp = await client.get("/api/yaml/parse", params={"path": "../etc/passwd"})
    assert resp.status_code == 400
