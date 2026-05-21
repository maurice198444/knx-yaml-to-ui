"""Shared pytest fixtures for backend tests."""
from __future__ import annotations

import asyncio
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest


@pytest.fixture
def tmp_knx_dir(tmp_path: Path) -> Path:
    """Simulate /config/knx with a few YAML files."""
    knx = tmp_path / "knx"
    knx.mkdir()
    (knx / "light.yaml").write_text(
        "light:\n  - name: Diele\n    address: 1/0/15\n    state_address: 1/5/15\n",
        encoding="utf-8",
    )
    (knx / "switch.yaml").write_text(
        "switch:\n  - name: Steckdose\n    address: 2/0/1\n",
        encoding="utf-8",
    )
    return knx


@pytest.fixture
def event_loop() -> Iterator[asyncio.AbstractEventLoop]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


class FakeHAClient:
    """In-memory stand-in for HAClient. Records calls; canned results."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.results: dict[str, Any] = {}
        self.errors: dict[str, str] = {}
        self.next_entity_id = "light.diele"

    async def send(self, payload: dict[str, Any]) -> Any:
        self.sent.append(payload)
        ptype = payload["type"]
        if ptype in self.errors:
            from app.adapters.ha_client import HAClientError

            raise HAClientError(self.errors[ptype])
        if ptype in self.results:
            return self.results[ptype]
        if ptype == "knx/validate_entity":
            return {"success": True}
        if ptype == "knx/create_entity":
            return {"entity_id": self.next_entity_id, "unique_id": "abc123"}
        if ptype == "config/entity_registry/list":
            return []
        return {}


@pytest.fixture
def fake_ha_client() -> FakeHAClient:
    return FakeHAClient()
