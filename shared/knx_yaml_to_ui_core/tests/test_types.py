"""Type shape assertions — these compile-time-pass via mypy --strict."""

from knx_yaml_to_ui_core.types import ParsedDomains, ParsedEntity, UIEntityPayload


def test_parsed_entity_required_keys() -> None:
    entry: ParsedEntity = {"name": "Diele", "knx": {"address": "1/0/15"}}
    assert entry["name"] == "Diele"


def test_parsed_domains_is_dict_of_lists() -> None:
    parsed: ParsedDomains = {"light": [{"name": "Diele", "knx": {}}]}
    assert "light" in parsed
    assert isinstance(parsed["light"], list)


def test_ui_entity_payload_has_platform_and_data() -> None:
    payload: UIEntityPayload = {
        "platform": "light",
        "data": {
            "entity": {"name": "Diele", "device_info": None, "entity_category": None},
            "knx": {"ga_switch": {"write": "1/0/15", "state": None, "passive": []}},
        },
    }
    assert payload["platform"] == "light"
