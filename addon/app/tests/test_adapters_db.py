"""Migration-history SQLite adapter — append-only insert + list."""

from pathlib import Path

import pytest

from app.adapters.db import DB


@pytest.mark.asyncio
async def test_insert_then_list_returns_row(tmp_path: Path) -> None:
    db = DB(path=tmp_path / "history.db")
    await db.init()
    row_id = await db.insert_row(
        kind="convert.commit",
        payload={"entity_id": "light.diele", "applied": True},
        status="ok",
    )
    rows = await db.list_rows(limit=10)
    assert len(rows) == 1
    assert rows[0]["id"] == row_id
    assert rows[0]["kind"] == "convert.commit"
    assert rows[0]["status"] == "ok"
    assert rows[0]["payload"]["entity_id"] == "light.diele"


@pytest.mark.asyncio
async def test_list_returns_most_recent_first(tmp_path: Path) -> None:
    db = DB(path=tmp_path / "history.db")
    await db.init()
    await db.insert_row(kind="x", payload={"n": 1}, status="ok")
    await db.insert_row(kind="x", payload={"n": 2}, status="ok")
    rows = await db.list_rows(limit=10)
    assert [r["payload"]["n"] for r in rows] == [2, 1]


@pytest.mark.asyncio
async def test_init_is_idempotent(tmp_path: Path) -> None:
    db = DB(path=tmp_path / "history.db")
    await db.init()
    await db.init()
