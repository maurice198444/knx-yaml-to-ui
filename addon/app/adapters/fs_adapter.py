"""Async filesystem adapter for /config/knx/*.yaml.

Reads, lists, and atomically writes YAML files under a fixed root. Rejects
any path that resolves outside the configured root (path-traversal defense).
"""
from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path


class FsError(OSError):
    """Filesystem operation rejected or failed."""


class FsAdapter:
    """Async adapter — all blocking calls go through asyncio.to_thread."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root).resolve()

    def _resolve(self, name: str) -> Path:
        candidate = (self.root / name).resolve()
        try:
            candidate.relative_to(self.root)
        except ValueError as exc:
            raise FsError(f"path '{name}' resolves outside root") from exc
        return candidate

    async def list_files(self) -> list[str]:
        def _scan() -> list[str]:
            return sorted(
                p.name for p in self.root.iterdir() if p.is_file() and p.suffix == ".yaml"
            )

        return await asyncio.to_thread(_scan)

    async def read(self, name: str) -> bytes:
        path = self._resolve(name)
        return await asyncio.to_thread(path.read_bytes)

    async def write_atomic(self, name: str, content: bytes) -> None:
        path = self._resolve(name)

        def _write() -> None:
            fd, tmp_name = tempfile.mkstemp(
                prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
            )
            try:
                with os.fdopen(fd, "wb") as fh:
                    fh.write(content)
                os.replace(tmp_name, path)
            except Exception:
                Path(tmp_name).unlink(missing_ok=True)
                raise

        await asyncio.to_thread(_write)
