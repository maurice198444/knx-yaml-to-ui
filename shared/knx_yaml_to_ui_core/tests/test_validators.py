"""Validators ensure entities pass minimum shape requirements before building."""
import pytest

from knx_yaml_to_ui_core.validators import (
    UnsupportedFeature,
    ValidationError,
    require_keys,
    validate_ga,
    reject_setpoint_shift,
)


def test_require_keys_passes_when_all_present() -> None:
    require_keys({"name": "x", "address": "1/0/1"}, ("name", "address"), entity_label="Light Diele")


def test_require_keys_raises_when_missing() -> None:
    with pytest.raises(ValidationError) as exc:
        require_keys({"name": "x"}, ("name", "address"), entity_label="Light Diele")
    assert "address" in str(exc.value)
    assert "Light Diele" in str(exc.value)


def test_validate_ga_accepts_three_level() -> None:
    validate_ga("1/0/15", field="ga_switch.write")


def test_validate_ga_accepts_two_level() -> None:
    validate_ga("1/15", field="ga_switch.write")


def test_validate_ga_rejects_garbage() -> None:
    with pytest.raises(ValidationError):
        validate_ga("nope", field="ga_switch.write")


def test_reject_setpoint_shift_raises_unsupported_feature() -> None:
    with pytest.raises(UnsupportedFeature) as exc:
        reject_setpoint_shift({"setpoint_shift_address": "5/0/1"}, entity_label="Climate Diele")
    assert "setpoint_shift" in str(exc.value)
