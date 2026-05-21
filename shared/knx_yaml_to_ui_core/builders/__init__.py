"""Domain builders — pure functions YAML-dict → UIEntityPayload."""
from .light import build_light

BUILDERS = {
    "light": build_light,
}

__all__ = ["BUILDERS", "build_light"]
