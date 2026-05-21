"""SQLite migration_history adapter — append-only, async via aiosqlite."""
from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import aiosqlite

_SCHEMA = """
CREATE TABLE IF NOT EXISTS migration_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_migration_history_created_at
    ON migration_history (created_at DESC);
"""


class DB:
    def __init__(self, path: Path) -> None:
        self._path = Path(path)

    async def init(self) -> None:
        async with aiosqlite.connect(self._path) as conn:
            await conn.executescript(_SCHEMA)
            await conn.commit()

    async def insert_row(
        self, *, kind: str, payload: dict[str, Any], status: str
    ) -> int:
        created_at = datetime.now(UTC).isoformat()
        async with aiosqlite.connect(self._path) as conn:
            cursor = await conn.execute(
                "INSERT INTO migration_history (created_at, kind, status, payload) "
                "VALUES (?, ?, ?, ?)",
                (created_at, kind, status, json.dumps(payload)),
            )
            await conn.commit()
            assert cursor.lastrowid is not None
            return cursor.lastrowid

    async def list_rows(self, *, limit: int = 50) -> list[dict[str, Any]]:
        async with aiosqlite.connect(self._path) as conn:
            conn.row_factory = aiosqlite.Row
            cursor = await conn.execute(
                "SELECT id, created_at, kind, status, payload FROM migration_history "
                "ORDER BY id DESC LIMIT ?",
                (limit,),
            )
            rows = await cursor.fetchall()
        return [
            {
                "id": row["id"],
                "created_at": row["created_at"],
                "kind": row["kind"],
                "status": row["status"],
                "payload": json.loads(row["payload"]),
            }
            for row in rows
        ]
