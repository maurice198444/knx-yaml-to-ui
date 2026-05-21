"""FsAdapter — async read, list, atomic write of /config/knx YAML files."""
from pathlib import Path

import pytest

from app.adapters.fs_adapter import FsAdapter, FsError


@pytest.mark.asyncio
async def test_list_files_returns_yaml_only(tmp_knx_dir: Path) -> None:
    (tmp_knx_dir / "README.md").write_text("ignore me", encoding="utf-8")
    fs = FsAdapter(root=tmp_knx_dir)
    files = await fs.list_files()
    assert sorted(files) == ["light.yaml", "switch.yaml"]


@pytest.mark.asyncio
async def test_read_file_returns_bytes(tmp_knx_dir: Path) -> None:
    fs = FsAdapter(root=tmp_knx_dir)
    content = await fs.read("light.yaml")
    assert b"Diele" in content


@pytest.mark.asyncio
async def test_read_rejects_path_traversal(tmp_knx_dir: Path) -> None:
    fs = FsAdapter(root=tmp_knx_dir)
    with pytest.raises(FsError) as exc:
        await fs.read("../etc/passwd")
    assert "outside root" in str(exc.value)


@pytest.mark.asyncio
async def test_write_atomic_creates_file(tmp_knx_dir: Path) -> None:
    fs = FsAdapter(root=tmp_knx_dir)
    await fs.write_atomic("new.yaml", b"light: []\n")
    assert (tmp_knx_dir / "new.yaml").read_bytes() == b"light: []\n"


@pytest.mark.asyncio
async def test_write_atomic_uses_tempfile(tmp_knx_dir: Path) -> None:
    """No `.tmp` file should remain after a successful write."""
    fs = FsAdapter(root=tmp_knx_dir)
    await fs.write_atomic("new.yaml", b"x")
    leftover = list(tmp_knx_dir.glob("*.tmp"))
    assert leftover == []
