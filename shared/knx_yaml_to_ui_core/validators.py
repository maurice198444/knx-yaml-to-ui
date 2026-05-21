"""Pure validators. Inputs are dicts; outputs are exceptions (or nothing)."""
from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any


class ValidationError(ValueError):
    """Required key missing or wrong shape."""


class UnsupportedFeature(ValueError):
    """YAML uses a feature we deliberately do not support in UI-config-store."""


_GA_PATTERN = re.compile(r"^\d{1,2}(/\d{1,4}){1,2}$")


def require_keys(d: dict[str, Any], keys: Iterable[str], *, entity_label: str) -> None:
    """Raise ValidationError if any of the keys are missing or None."""
    missing = [k for k in keys if d.get(k) in (None, "")]
    if missing:
        raise ValidationError(
            f"{entity_label}: missing required keys {missing}"
        )


def validate_ga(value: str, *, field: str) -> None:
    """Raise ValidationError if value is not a valid KNX Group Address."""
    if not isinstance(value, str) or not _GA_PATTERN.match(value):
        raise ValidationError(f"{field}: '{value}' is not a valid KNX Group Address (e.g. 1/0/15)")


def reject_setpoint_shift(yml: dict[str, Any], *, entity_label: str) -> None:
    """Bugfix-driven gate — setpoint_shift climates have no UI-config-store schema."""
    if "setpoint_shift_address" in yml or "setpoint_shift_state_address" in yml:
        raise UnsupportedFeature(
            f"{entity_label}: setpoint_shift climate is not supported in UI-config-store; "
            "keep this entity in YAML"
        )
