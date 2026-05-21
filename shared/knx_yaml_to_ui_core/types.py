"""TypedDict definitions for the pure core. No I/O, no runtime deps."""
from typing import Any, NotRequired, TypedDict


class ParsedEntity(TypedDict):
    """One entity as parsed from YAML — minimal shape, builders consume this."""

    name: str
    knx: dict[str, Any]
    device_class: NotRequired[str]
    entity_category: NotRequired[str]


ParsedDomains = dict[str, list[ParsedEntity]]
"""Domain (e.g. 'light') → list of entities for that domain."""


class _UIEntityEntityBlock(TypedDict):
    name: str
    device_info: str | None
    entity_category: str | None


class _UIEntityDataBlock(TypedDict):
    entity: _UIEntityEntityBlock
    knx: dict[str, Any]  # domain-specific; light vs cover vs climate differ


class UIEntityPayload(TypedDict):
    """Payload shape expected by `knx/create_entity` / `knx/validate_entity`."""

    platform: str
    data: _UIEntityDataBlock
