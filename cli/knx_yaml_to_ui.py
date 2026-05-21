#!/usr/bin/env python
"""knx-yaml-to-ui - convert HA-KNX YAML configs to UI-managed config_store entries.

Reads KNX YAML (single file or directory), converts each entity to UI-Config-Store
schema, writes to H:/.storage/knx/config_store.json with ULID-based unique_ids.
device_class overrides extracted to JSON for separate application via HA API.

USAGE:
  knx_yaml_to_ui.py convert <path>  [--add|--replace] [--dry-run] [--commit]
  knx_yaml_to_ui.py restore <timestamp>
  knx_yaml_to_ui.py list-backups
  knx_yaml_to_ui.py apply-device-classes <overrides.json> [--token TOKEN] [--url URL]

EXAMPLES:
  # Single file, append to existing UI entities
  python knx_yaml_to_ui.py convert H:/knx_addon.yaml --add --commit

  # Directory of split files (light.yaml, switch.yaml, ...), full replace
  python knx_yaml_to_ui.py convert H:/knx/ --replace --commit

  # Preview without writing
  python knx_yaml_to_ui.py convert H:/knx_addon.yaml --add --dry-run

  # Rollback last conversion
  python knx_yaml_to_ui.py restore 20260521_030839

SUPPORTED YAML SHAPES:
  - Single file with top-level "knx:" wrapper:
      knx:
        light: [...]
        switch: [...]
  - Single file with bare domain keys:
      light: [...]
      switch: [...]
  - Single file with one domain only:
      light: [...]
  - Directory with one file per domain:
      light.yaml, switch.yaml, cover.yaml, ...

SUPPORTED DOMAINS:
  light (simple/brightness/RGBW), switch, cover, binary_sensor, sensor,
  climate (direct-mode), time

NOT auto-handled (YAML-only / no UI schema):
  notify, expose, time_server, sensor with setpoint_shift, climate setpoint_shift,
  switch with multiple state addresses (passive)

device_class is extracted but not applied - YAML carries it, UI stores it in
core.entity_registry. Apply afterwards via:
  python knx_yaml_to_ui.py apply-device-classes overrides.json
"""
import argparse
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

try:
    import yaml
except ImportError:
    print("ERROR: pyyaml required - pip install pyyaml", file=sys.stderr)
    sys.exit(1)

from knx_yaml_to_ui_core.slugify import slugify
from knx_yaml_to_ui_core.ulid import CROCKFORD, gen_ulid

# ---------- config ----------
HA_CONFIG_DIR = Path(os.environ.get("HA_CONFIG_DIR", "H:/"))
CONFIG_STORE = HA_CONFIG_DIR / ".storage" / "knx" / "config_store.json"
ENTITY_REGISTRY = HA_CONFIG_DIR / ".storage" / "core.entity_registry"

DOMAINS = ("light", "switch", "cover", "binary_sensor", "sensor", "climate",
           "time", "datetime", "scene")

SENSOR_TYPE_TO_DPT = {
    "temperature": "9.001",
    "illuminance": "9.004",
    "humidity": "9.007",
    "wind_speed_ms": "9.005",
    "wind_speed_kmh": "9.028",
    "power": "14.056",
    "active_energy_kwh": "13.013",
    "active_energy_wh": "13.010",
    "current": "9.021",
    "voltage": "9.020",
    "pressure": "9.006",
    "co2": "9.008",
    "frequency": "14.033",
    "percent": "5.001",
    "absolute_humidity": "9.029",
    "rain_amount": "9.026",
    "wind_speed": "9.005",
}

# ---------- ULID wrapper ----------

def ulid() -> str:
    time.sleep(0.001)  # ensure monotonic across calls
    return f"knx_es_{gen_ulid()}"


# ---------- helpers ----------

def to_sync_state(v):
    if isinstance(v, bool):
        return v
    if v is None:
        return True
    return True  # "every X" strings -> true (UI doesn't support intervals)


# ---------- domain builders ----------

def build_light(yml: dict) -> dict:
    knx = {
        "ga_switch": {
            "write": yml["address"],
            "state": yml.get("state_address"),
            "passive": [],
        },
        "sync_state": True,
        "color_temp_min": 2700.0,
        "color_temp_max": 6000.0,
    }
    if "brightness_address" in yml:
        knx["ga_brightness"] = {
            "write": yml["brightness_address"],
            "state": yml.get("brightness_state_address"),
            "passive": [],
        }
    if "rgbw_address" in yml or "color_address" in yml:
        write = yml.get("rgbw_address") or yml.get("color_address")
        dpt = "232.600" if "rgbw_address" in yml else "232.600"
        knx["color"] = {
            "ga_color": {
                "write": write,
                "dpt": dpt,
                "state": yml.get("rgbw_state_address") or yml.get("color_state_address"),
                "passive": [],
            }
        }
    return knx


def build_switch(yml: dict) -> dict:
    return {
        "ga_switch": {
            "write": yml["address"],
            "state": yml.get("state_address"),
            "passive": [],
        },
        "invert": yml.get("invert", False),
        "sync_state": True,
        "respond_to_read": yml.get("respond_to_read", False),
    }


def build_cover(yml: dict) -> dict:
    knx = {
        "ga_up_down": {"write": yml["move_long_address"], "passive": []},
        "ga_stop": {"write": yml["stop_address"], "passive": []},
        "ga_step": {"write": yml["stop_address"], "passive": []},
        "ga_position_set": {"write": yml["position_address"], "passive": []},
        "travelling_time_up": float(yml.get("travelling_time_up", 25)),
        "travelling_time_down": float(yml.get("travelling_time_down", 25)),
        "sync_state": True,
        "invert_updown": yml.get("invert_updown", False),
    }
    if "position_state_address" in yml:
        knx["ga_position_state"] = {
            "state": yml["position_state_address"],
            "passive": [],
        }
    return knx


def build_binary_sensor(yml: dict) -> dict:
    return {
        "ga_sensor": {"state": yml["state_address"], "passive": []},
        "sync_state": to_sync_state(yml.get("sync_state", True)),
    }


def build_sensor(yml: dict) -> dict:
    yaml_type = yml.get("type")
    dpt = SENSOR_TYPE_TO_DPT.get(yaml_type)
    if not dpt:
        raise ValueError(
            f"Sensor type '{yaml_type}' for '{yml.get('name')}' not mapped. "
            f"Add to SENSOR_TYPE_TO_DPT or specify 'dpt' explicitly in YAML."
        )
    if "dpt" in yml:
        dpt = str(yml["dpt"])
    return {
        "ga_sensor": {
            "state": yml["state_address"],
            "dpt": dpt,
            "passive": yml.get("passive_state_addresses", []),
        },
        "sync_state": to_sync_state(yml.get("sync_state", True)),
    }


def build_climate(yml: dict) -> dict:
    if "setpoint_shift_address" in yml:
        raise ValueError(
            f"Climate '{yml.get('name')}' uses setpoint_shift_address — "
            "UI schema currently supports only direct-mode "
            "(target_temperature_address). Convert to direct-mode in YAML first "
            "or skip this entity."
        )
    knx = {
        "ga_temperature_current": {
            "state": yml["temperature_address"],
            "passive": [],
        },
        "target_temperature": {
            "ga_temperature_target": {
                "write": yml["target_temperature_address"],
                "state": yml.get("target_temperature_state_address"),
                "passive": [],
            },
            "temperature_step": float(yml.get("temperature_step", 0.5)),
            "min_temp": float(yml.get("min_temp", 7.0)),
            "max_temp": float(yml.get("max_temp", 30.0)),
        },
        "ga_operation_mode": {
            "write": yml["operation_mode_address"],
            "state": yml.get("operation_mode_state_address"),
            "passive": [],
        },
        "fan_max_step": 3,
        "sync_state": True,
        "default_controller_mode": "heat",
        "fan_zero_mode": "off",
    }
    if "heat_cool_address" in yml:
        knx["ga_heat_cool"] = {
            "write": yml["heat_cool_address"],
            "state": yml.get("heat_cool_state_address"),
            "passive": [],
        }
    return knx


def build_time(yml: dict) -> dict:
    addr = yml["address"]
    return {
        "ga_time": {"write": addr, "state": addr, "passive": []},
        "sync_state": True,
        "respond_to_read": bool(yml.get("respond_to_read", True)),
    }


DOMAIN_BUILDERS = {
    "light": build_light,
    "switch": build_switch,
    "cover": build_cover,
    "binary_sensor": build_binary_sensor,
    "sensor": build_sensor,
    "climate": build_climate,
    "time": build_time,
}


# ---------- YAML parsing ----------

def load_yaml(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def parse_source(source: Path) -> dict[str, list[dict]]:
    """Returns {domain: [yaml_entry, ...]}. Handles file or directory input."""
    out = {}
    if source.is_dir():
        for f in source.glob("*.yaml"):
            if "bak" in f.name:
                continue
            data = load_yaml(f)
            domain = f.stem  # e.g. "light" from "light.yaml"
            if domain in DOMAIN_BUILDERS:
                entries = data.get(domain, [])
                if entries:
                    out.setdefault(domain, []).extend(entries)
    else:
        data = load_yaml(source)
        # Could be wrapped under "knx:" or bare
        root = data.get("knx") if "knx" in data and isinstance(data["knx"], dict) else data
        for domain in DOMAIN_BUILDERS:
            entries = root.get(domain, [])
            if entries:
                out.setdefault(domain, []).extend(entries)
    return out


def entity_envelope(name: str, knx_obj: dict) -> dict:
    return {
        "entity": {"name": name, "entity_category": None, "device_info": None},
        "knx": knx_obj,
    }


def collect_overrides(parsed: dict[str, list[dict]]) -> list[dict]:
    out = []
    for domain, items in parsed.items():
        for yml in items:
            dc = yml.get("device_class")
            if dc:
                out.append({
                    "entity_id": f"{domain}.{slugify(yml['name'])}",
                    "device_class": dc,
                })
    return out


def empty_store_skeleton() -> dict:
    return {
        "version": 2,
        "minor_version": 4,
        "key": "knx/config_store.json",
        "data": {
            "entities": {d: {} for d in DOMAINS},
            "time_server": {},
            "expose": {},
        },
    }


def build_entries(parsed: dict[str, list[dict]]) -> dict[str, dict]:
    """Returns {domain: {ulid: envelope}}."""
    result = {}
    errors = []
    for domain, items in parsed.items():
        builder = DOMAIN_BUILDERS[domain]
        for yml in items:
            try:
                envelope = entity_envelope(yml["name"], builder(yml))
                result.setdefault(domain, {})[ulid()] = envelope
            except Exception as e:
                errors.append((domain, yml.get("name", "<noname>"), str(e)))
    if errors:
        print("\nERRORS during build:", file=sys.stderr)
        for d, n, msg in errors:
            print(f"  [{d}] {n}: {msg}", file=sys.stderr)
        print(f"\n{len(errors)} entities could not be built. Skipped.",
              file=sys.stderr)
    return result


# ---------- IO ----------

def backup_file(path: Path, ts: str) -> Path:
    bak = path.with_suffix(path.suffix + f".bak.{ts}")
    shutil.copy2(path, bak)
    return bak


def load_config_store() -> dict:
    if not CONFIG_STORE.exists():
        return empty_store_skeleton()
    with open(CONFIG_STORE, "r", encoding="utf-8") as f:
        store = json.load(f)
    # ensure all domains exist
    for d in DOMAINS:
        store["data"]["entities"].setdefault(d, {})
    return store


def write_config_store(store: dict):
    CONFIG_STORE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_STORE, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=2, ensure_ascii=False)


def filter_entity_registry_knx_out():
    """Strip all platform=knx entries from entity_registry."""
    with open(ENTITY_REGISTRY, "r", encoding="utf-8") as f:
        reg = json.load(f)
    orig = reg["data"]["entities"]
    kept = [e for e in orig if e.get("platform") != "knx"]
    removed = len(orig) - len(kept)
    reg["data"]["entities"] = kept
    with open(ENTITY_REGISTRY, "w", encoding="utf-8") as f:
        json.dump(reg, f, indent=2, ensure_ascii=False)
    return removed


# ---------- subcommands ----------

def cmd_convert(args):
    source = Path(args.path)
    if not source.exists():
        print(f"ERROR: {source} not found", file=sys.stderr)
        sys.exit(1)

    parsed = parse_source(source)
    if not parsed:
        print(f"No KNX YAML entries found in {source}")
        return

    total = sum(len(v) for v in parsed.values())
    print(f"Parsed {total} entities from {source}:")
    for d, items in parsed.items():
        print(f"  {d}: {len(items)}")

    new_entries = build_entries(parsed)
    overrides = collect_overrides(parsed)
    built_total = sum(len(v) for v in new_entries.values())

    print(f"\nBuilt {built_total} entries ({len(overrides)} device_class overrides)")

    if args.dry_run or not args.commit:
        preview_path = source.parent / f"_knx_ui_preview.json" \
            if source.is_dir() else source.parent / f"{source.stem}_ui_preview.json"
        preview = empty_store_skeleton()
        for d, entries in new_entries.items():
            preview["data"]["entities"][d] = entries
        with open(preview_path, "w", encoding="utf-8") as f:
            json.dump(preview, f, indent=2, ensure_ascii=False)
        overrides_path = preview_path.with_name("device_class_overrides.json")
        with open(overrides_path, "w", encoding="utf-8") as f:
            json.dump(overrides, f, indent=2)
        print(f"\nDRY RUN — preview written:")
        print(f"  {preview_path}")
        print(f"  {overrides_path}")
        if not args.commit:
            print("\nTo commit: add --commit")
        return

    # commit
    ts = time.strftime("%Y%m%d_%H%M%S")
    print(f"\nBackup timestamp: {ts}")
    if CONFIG_STORE.exists():
        print(f"  {backup_file(CONFIG_STORE, ts)}")
    if ENTITY_REGISTRY.exists():
        print(f"  {backup_file(ENTITY_REGISTRY, ts)}")

    store = load_config_store()

    if args.mode == "replace":
        for d in DOMAINS:
            store["data"]["entities"][d] = {}
        if ENTITY_REGISTRY.exists():
            removed = filter_entity_registry_knx_out()
            print(f"  Removed {removed} platform=knx entries from entity_registry")

    for d, entries in new_entries.items():
        store["data"]["entities"][d].update(entries)

    write_config_store(store)
    print(f"Wrote {CONFIG_STORE}")

    overrides_path = source.parent / f"device_class_overrides_{ts}.json"
    with open(overrides_path, "w", encoding="utf-8") as f:
        json.dump(overrides, f, indent=2)
    print(f"\ndevice_class overrides: {overrides_path}")
    print(f"  Apply via: python knx_yaml_to_ui.py apply-device-classes {overrides_path}")
    print("\nDONE. Restart HA, then apply device_class overrides.")


def cmd_restore(args):
    ts = args.timestamp
    cs_bak = CONFIG_STORE.with_suffix(CONFIG_STORE.suffix + f".bak.{ts}")
    er_bak = ENTITY_REGISTRY.with_suffix(ENTITY_REGISTRY.suffix + f".bak.{ts}")
    if not cs_bak.exists():
        print(f"ERROR: backup not found: {cs_bak}", file=sys.stderr)
        sys.exit(1)
    shutil.copy2(cs_bak, CONFIG_STORE)
    print(f"Restored {CONFIG_STORE}")
    if er_bak.exists():
        shutil.copy2(er_bak, ENTITY_REGISTRY)
        print(f"Restored {ENTITY_REGISTRY}")
    print("\nDONE. Restart HA.")


def cmd_list_backups(args):
    storage_dir = HA_CONFIG_DIR / ".storage"
    cs_baks = sorted((storage_dir / "knx").glob("config_store.json.bak.*"))
    er_baks = sorted(storage_dir.glob("core.entity_registry.bak.*"))
    print("config_store backups:")
    for b in cs_baks:
        size_kb = b.stat().st_size / 1024
        print(f"  {b.name}  ({size_kb:.1f}kB)")
    print("\nentity_registry backups:")
    for b in er_baks:
        size_kb = b.stat().st_size / 1024
        print(f"  {b.name}  ({size_kb:.1f}kB)")


def cmd_apply_device_classes(args):
    """Apply device_class via HA REST API."""
    import urllib.request
    import urllib.error

    token = args.token or os.environ.get("HA_TOKEN")
    if not token:
        print("ERROR: HA_TOKEN env var or --token required", file=sys.stderr)
        sys.exit(1)
    url = args.url or os.environ.get("HA_URL", "http://192.168.2.238:8123")

    with open(args.overrides) as f:
        overrides = json.load(f)

    for ov in overrides:
        ep = f"{url}/api/services/?"  # not used directly
        # WebSocket needed for entity_registry/update. REST has no equivalent.
        # Use ha-mcp via Claude OR write to entity_registry directly when HA down.
        print(f"  {ov['entity_id']} -> {ov['device_class']}  (apply via Claude/UI)")
    print(f"\nTotal: {len(overrides)} overrides — use Claude's ha_set_entity tool to apply.")


# ---------- main ----------

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("convert", help="Convert YAML to UI entries")
    c.add_argument("path", help="YAML file or directory of YAML files")
    mode_group = c.add_mutually_exclusive_group()
    mode_group.add_argument("--mode", choices=("add", "replace"), default="add",
                            help="add=append, replace=clean+full migration (default: add)")
    mode_group.add_argument("--add", dest="mode", action="store_const", const="add",
                            help="shortcut for --mode add")
    mode_group.add_argument("--replace", dest="mode", action="store_const", const="replace",
                            help="shortcut for --mode replace")
    c.add_argument("--dry-run", action="store_true", help="Preview only")
    c.add_argument("--commit", action="store_true", help="Write changes (required for write)")
    c.set_defaults(func=cmd_convert)

    r = sub.add_parser("restore", help="Restore backup")
    r.add_argument("timestamp", help="Backup timestamp e.g. 20260521_030839")
    r.set_defaults(func=cmd_restore)

    b = sub.add_parser("list-backups", help="List available backups")
    b.set_defaults(func=cmd_list_backups)

    a = sub.add_parser("apply-device-classes", help="Show device_class overrides for manual application")
    a.add_argument("overrides", help="device_class_overrides.json")
    a.add_argument("--token", help="HA bearer token")
    a.add_argument("--url", help="HA URL (default: http://192.168.2.238:8123)")
    a.set_defaults(func=cmd_apply_device_classes)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
