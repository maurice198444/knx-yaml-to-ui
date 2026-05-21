"""Light builder unit tests covering Bugfix #4 (color_temp only for CCT mode)."""

import pytest

from knx_yaml_to_ui_core.builders.light import build_light
from knx_yaml_to_ui_core.validators import ValidationError


def test_build_simple_light() -> None:
    yml = {
        "name": "Diele",
        "address": "1/0/15",
        "state_address": "1/5/15",
    }
    payload = build_light(yml)
    assert payload["platform"] == "light"
    assert payload["data"]["entity"]["name"] == "Diele"
    assert payload["data"]["knx"]["ga_switch"] == {
        "write": "1/0/15",
        "state": "1/5/15",
        "passive": [],
    }
    # Bugfix #4: no color_temp keys unless CCT mode declared
    assert "color_temperature_mode" not in payload["data"]["knx"]
    assert "ga_color_temp" not in payload["data"]["knx"]


def test_build_light_with_brightness() -> None:
    yml = {
        "name": "Diele",
        "address": "1/0/15",
        "state_address": "1/5/15",
        "brightness_address": "1/0/16",
        "brightness_state_address": "1/5/16",
    }
    payload = build_light(yml)
    assert payload["data"]["knx"]["ga_brightness"] == {
        "write": "1/0/16",
        "state": "1/5/16",
        "passive": [],
    }


def test_build_light_cct_includes_color_temp_block() -> None:
    """Bugfix #4 positive case — only when color_temperature_mode is set explicitly."""
    yml = {
        "name": "Diele",
        "address": "1/0/15",
        "state_address": "1/5/15",
        "color_temperature_mode": "absolute",
        "color_temperature_address": "1/0/20",
        "color_temperature_state_address": "1/5/20",
        "min_kelvin": 2700,
        "max_kelvin": 6500,
    }
    payload = build_light(yml)
    assert payload["data"]["knx"]["color_temperature_mode"] == "absolute"
    assert payload["data"]["knx"]["ga_color_temp"]["write"] == "1/0/20"
    assert payload["data"]["knx"]["min_kelvin"] == 2700
    assert payload["data"]["knx"]["max_kelvin"] == 6500


def test_build_light_without_color_temp_mode_drops_temp_keys() -> None:
    """Bugfix #4: even if temp-addresses are present, drop them when mode missing."""
    yml = {
        "name": "Diele",
        "address": "1/0/15",
        "state_address": "1/5/15",
        "color_temperature_address": "1/0/20",  # mode missing → must be ignored
    }
    payload = build_light(yml)
    assert "ga_color_temp" not in payload["data"]["knx"]
    assert "color_temperature_mode" not in payload["data"]["knx"]


def test_build_light_missing_name_raises_validation_error() -> None:
    with pytest.raises(ValidationError):
        build_light({"address": "1/0/15"})


def test_build_light_invalid_ga_raises_validation_error() -> None:
    with pytest.raises(ValidationError):
        build_light({"name": "Diele", "address": "garbage"})
