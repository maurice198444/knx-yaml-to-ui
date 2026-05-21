"""Shared dependencies — supervisor-token, HA-WS-client (stub until Slice 1)."""

import os


def get_supervisor_token() -> str | None:
    """Return the supervisor-token env var (injected by HA Add-on framework)."""
    return os.environ.get("SUPERVISOR_TOKEN")


def get_ha_url() -> str:
    """Default to supervisor proxy URL."""
    return os.environ.get("HA_URL", "http://supervisor/core")
