"""Tests for slugify — entity_id-safe slugs with German umlaut transliteration (Bugfix #3)."""

import re

import pytest

from knx_yaml_to_ui_core.slugify import slugify


@pytest.mark.parametrize(
    "name,expected",
    [
        # ascii baseline
        ("Heizung Diele", "heizung_diele"),
        ("Bewegung EG/Flur", "bewegung_eg_flur"),
        ("Steckdose #1", "steckdose_1"),
        ("Wohnzimmer  Decke", "wohnzimmer_decke"),  # double-space collapses
        ("  Leading and trailing  ", "leading_and_trailing"),
        # umlaut transliteration (Bugfix #3)
        ("Heizung Küche", "heizung_kueche"),
        ("Außenbereich", "aussenbereich"),
        ("Spülmaschine", "spuelmaschine"),
        ("Übergang", "uebergang"),
        ("Ärger", "aerger"),
        ("Östlich", "oestlich"),
        # mixed
        ("KÜCHE oben", "kueche_oben"),
        ("Müller-Lüdenscheidt", "mueller_luedenscheidt"),
    ],
)
def test_slugify_cases(name: str, expected: str) -> None:
    assert slugify(name) == expected


def test_slugify_idempotent() -> None:
    assert slugify(slugify("Heizung Küche")) == "heizung_kueche"


def test_slugify_only_ascii_output() -> None:
    """Output must be a-z0-9_ only — no umlauts, no spaces, no punctuation."""
    for inp in ["Küche & Bad", "Außen-Wand 1", "ÖÄÜß"]:
        out = slugify(inp)
        assert re.match(r"^[a-z0-9_]+$", out), f"Non-ascii chars in {out!r}"
