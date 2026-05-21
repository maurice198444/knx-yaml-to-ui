"""Shared pytest fixtures for backend tests."""
from __future__ import annotations

import asyncio
from collections.abc import Iterator
from pathlib import Path

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
