"""Entity-id-safe slug generation with German umlaut transliteration."""
import re

_UMLAUT_MAP = str.maketrans({
    "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
    "Ä": "Ae", "Ö": "Oe", "Ü": "Ue",
})


def slugify(name: str) -> str:
    """Convert a display name to a HA-entity_id-safe slug.

    German umlauts are transliterated (ä->ae etc.) before ASCII normalization,
    so 'Heizung Küche' -> 'heizung_kueche', not 'heizung_k_che'.
    """
    s = name.translate(_UMLAUT_MAP).lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s
