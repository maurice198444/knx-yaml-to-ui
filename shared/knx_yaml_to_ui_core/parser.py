"""YAML-to-ParsedDomains parser. Pure: input bytes, output dict. No I/O."""

from __future__ import annotations

import yaml

from .types import ParsedDomains


class ParseError(ValueError):
    """Raised on malformed YAML or unexpected shape."""


def parse_yaml(content: bytes) -> ParsedDomains:
    """Parse YAML bytes into a ParsedDomains dict.

    Supports three shapes:
    1. Top-level `knx:` wrapper with domain children
    2. Bare top-level domain keys (`light:`, `switch:`, ...)
    3. Single-domain file (only one of the above keys present)

    Empty input returns {}.
    """
    if not content.strip():
        return {}
    try:
        loaded = yaml.safe_load(content)
    except yaml.YAMLError as exc:
        raise ParseError(f"YAML parse failed: {exc}") from exc

    if loaded is None:
        return {}
    if not isinstance(loaded, dict):
        raise ParseError(f"Expected top-level mapping, got {type(loaded).__name__}")

    # Unwrap `knx:` if present
    if "knx" in loaded and isinstance(loaded["knx"], dict):
        loaded = loaded["knx"]

    result: ParsedDomains = {}
    for domain, entries in loaded.items():
        if not isinstance(entries, list):
            raise ParseError(f"Domain '{domain}' value must be a list of entities")
        result[domain] = entries
    return result
