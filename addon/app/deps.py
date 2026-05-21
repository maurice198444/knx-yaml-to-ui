"""FastAPI dependencies — singletons created once per process."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from .adapters.db import DB
from .adapters.fs_adapter import FsAdapter
from .adapters.ha_client import HAClient


def get_supervisor_token() -> str:
    token = os.environ.get("SUPERVISOR_TOKEN")
    if not token:
        raise RuntimeError(
            "SUPERVISOR_TOKEN not set — Add-on must run under HA Supervisor"
        )
    return token


def get_ha_ws_url() -> str:
    return os.environ.get("HA_WS_URL", "ws://supervisor/core/websocket")


def get_ha_rest_url() -> str:
    return os.environ.get("HA_REST_URL", "http://supervisor/core")


@lru_cache(maxsize=1)
def get_knx_root() -> Path:
    return Path(os.environ.get("KNX_ROOT", "/config/knx"))


@lru_cache(maxsize=1)
def get_data_dir() -> Path:
    return Path(os.environ.get("DATA_DIR", "/data"))


@lru_cache(maxsize=1)
def get_fs_adapter() -> FsAdapter:
    return FsAdapter(root=get_knx_root())


@lru_cache(maxsize=1)
def get_db() -> DB:
    return DB(path=get_data_dir() / "migration_history.db")


_ha_client_holder: dict[str, HAClient] = {}


def set_ha_client(client: HAClient) -> None:
    _ha_client_holder["client"] = client


def get_ha_client() -> HAClient:
    if "client" not in _ha_client_holder:
        raise RuntimeError("HAClient not initialised")
    return _ha_client_holder["client"]
