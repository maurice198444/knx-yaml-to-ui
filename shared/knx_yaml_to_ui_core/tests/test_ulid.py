"""Tests for ULID generation — Crockford Base32, 26 chars, time-component-monotonic."""

import re
import time

from knx_yaml_to_ui_core.ulid import CROCKFORD, gen_ulid


def test_ulid_is_26_chars() -> None:
    ulid = gen_ulid()
    assert len(ulid) == 26, f"ULID must be 26 chars, got {len(ulid)}: {ulid!r}"


def test_ulid_uses_crockford_alphabet_only() -> None:
    ulid = gen_ulid()
    pattern = f"^[{CROCKFORD}]{{26}}$"
    assert re.match(pattern, ulid), f"ULID has chars outside Crockford: {ulid!r}"


def test_ulid_time_component_is_monotonic() -> None:
    """First 10 chars encode 48-bit ms-timestamp — must be non-decreasing across calls."""
    a = gen_ulid()
    time.sleep(0.002)
    b = gen_ulid()
    assert a[:10] <= b[:10], f"Time-component regressed: {a[:10]} -> {b[:10]}"


def test_ulid_uniqueness_across_1000_calls() -> None:
    """Random-component (last 16 chars) collision probability is ~ 2^-80 per pair."""
    ulids = {gen_ulid() for _ in range(1000)}
    assert len(ulids) == 1000, "Collision detected in 1000-ULID sample"


def test_crockford_alphabet_constant() -> None:
    assert CROCKFORD == "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    assert len(CROCKFORD) == 32
