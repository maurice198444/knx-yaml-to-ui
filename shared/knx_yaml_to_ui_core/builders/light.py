"""Light builder — YAML entry to UI-config-store payload.

Bugfix #4: color_temperature block is only emitted when `color_temperature_mode`
is set explicitly. Naked temperature-addresses without a mode are dropped.
"""
from __future__ import annotations

from typing import Any

from ..types import UIEntityPayload
from ..validators import require_keys, validate_ga


def _ga_block(write: str, state: str | None) -> dict[str, Any]:
    return {"write": write, "state": state, "passive": []}


def build_light(yml: dict[str, Any]) -> UIEntityPayload:
    """Convert a single YAML light entity to a UI-config-store payload."""
    label = f"Light {yml.get('name', '<unnamed>')}"
    require_keys(yml, ("name", "address"), entity_label=label)
    validate_ga(yml["address"], field=f"{label}.address")

    knx: dict[str, Any] = {
        "ga_switch": _ga_block(yml["address"], yml.get("state_address")),
    }

    if "brightness_address" in yml:
        validate_ga(yml["brightness_address"], field=f"{label}.brightness_address")
        knx["ga_brightness"] = _ga_block(
            yml["brightness_address"], yml.get("brightness_state_address")
        )

    # Bugfix #4: color_temperature block only when mode is set
    mode = yml.get("color_temperature_mode")
    if mode in ("absolute", "relative"):
        ct_addr = yml.get("color_temperature_address")
        if ct_addr:
            validate_ga(ct_addr, field=f"{label}.color_temperature_address")
            knx["color_temperature_mode"] = mode
            knx["ga_color_temp"] = _ga_block(
                ct_addr, yml.get("color_temperature_state_address")
            )
            if "min_kelvin" in yml:
                knx["min_kelvin"] = yml["min_kelvin"]
            if "max_kelvin" in yml:
                knx["max_kelvin"] = yml["max_kelvin"]

    payload: UIEntityPayload = {
        "platform": "light",
        "data": {
            "entity": {
                "name": yml["name"],
                "device_info": None,
                "entity_category": yml.get("entity_category"),
            },
            "knx": knx,
        },
    }
    return payload
