"""Parser unit tests — covers 3 supported YAML shapes plus error paths."""
from pathlib import Path

import pytest

from knx_yaml_to_ui_core.parser import ParseError, parse_yaml

FIXTURES = Path(__file__).parent / "fixtures" / "yaml"


def test_parse_wrapped_yaml_returns_domains() -> None:
    parsed = parse_yaml(FIXTURES.joinpath("light_wrapped.yaml").read_bytes())
    assert list(parsed.keys()) == ["light"]
    assert parsed["light"][0]["name"] == "Diele"


def test_parse_bare_yaml_with_multiple_domains() -> None:
    parsed = parse_yaml(FIXTURES.joinpath("light_bare.yaml").read_bytes())
    assert set(parsed.keys()) == {"light", "switch"}


def test_parse_single_domain_yaml() -> None:
    parsed = parse_yaml(FIXTURES.joinpath("light_single_domain.yaml").read_bytes())
    assert parsed["light"][0]["name"] == "Küche"


def test_parse_malformed_yaml_raises_parse_error() -> None:
    with pytest.raises(ParseError) as exc:
        parse_yaml(FIXTURES.joinpath("malformed.yaml").read_bytes())
    assert "yaml" in str(exc.value).lower()


def test_parse_empty_bytes_returns_empty_dict() -> None:
    assert parse_yaml(b"") == {}


def test_parse_unknown_domain_is_kept_as_is() -> None:
    parsed = parse_yaml(b"foo:\n  - name: bar\n")
    assert "foo" in parsed
