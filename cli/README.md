# knx-yaml-to-ui

Convert HA-KNX YAML configs to UI-managed `config_store.json` entries.

## Use Cases

- Migrate existing YAML-based KNX setup to UI-managed entities (so they appear
  in the Configure-Dialog).
- Add new KNX YAML batches to an existing UI-managed setup.
- Roll back a botched migration.

## Quickstart

```bash
# Install
pip install pyyaml

# Preview a single YAML file
python knx_yaml_to_ui.py convert H:/knx_addon.yaml --add --dry-run

# Commit: append to existing UI entries
python knx_yaml_to_ui.py convert H:/knx_addon.yaml --add --commit

# Full migration from a directory of split files (light.yaml, switch.yaml, ...)
python knx_yaml_to_ui.py convert H:/knx/ --replace --commit

# Restart HA via Claude or `ha core restart`, then apply device_class:
python knx_yaml_to_ui.py apply-device-classes device_class_overrides_<ts>.json
# (prints list; apply via Claude's ha_set_entity tool)

# Roll back
python knx_yaml_to_ui.py restore 20260521_030839

# List available backups
python knx_yaml_to_ui.py list-backups
```

## YAML Shapes Supported

```yaml
# 1. With knx wrapper (HA-standard)
knx:
  light:
    - name: "Kueche Decke"
      address: "1/3/0"
      state_address: "1/3/10"
  switch:
    - ...

# 2. Bare (no knx: wrapper)
light:
  - name: ...
switch:
  - ...

# 3. Directory with one file per domain (auto-detected)
H:/knx/
  light.yaml          # contains top-level "light: [...]"
  switch.yaml
  cover.yaml
  ...
```

## Supported Domains

| Domain | Notes |
|--------|-------|
| light | simple / brightness / RGBW |
| switch | invert + respond_to_read |
| cover | only direct-position (no setpoint_shift) |
| binary_sensor | sync_state stays per yaml (string intervals collapse to true) |
| sensor | DPT auto-mapped from `type:` (see SENSOR_TYPE_TO_DPT in script). Use `dpt: "X.YYY"` to override |
| climate | direct-mode only (target_temperature_address). setpoint_shift mode → raises error |
| time | DPT 10.001 single-address |

## Modes

- `--add` (default): append new entities, keep existing UI entries
- `--replace`: clear existing UI entries + remove all `platform=knx` rows from
  `core.entity_registry` (for full YAML→UI migration). Run YAML files have to be
  renamed `.yaml.bak.*` manually after.

## Environment

- `HA_CONFIG_DIR`: defaults to `H:/`. Override if HA config elsewhere.
- `HA_TOKEN`: optional, for future REST-API features.
- `HA_URL`: defaults to `http://192.168.2.238:8123`.

## device_class

device_class lives in `core.entity_registry` (not `config_store.json`). Tool
extracts `device_class: outlet` etc. from YAML into `device_class_overrides_*.json`,
to be applied via Claude's `ha_set_entity(entity_id, device_class)` tool
after restart.

## Known Gaps

- **setpoint_shift climate**: not supported (UI schema requires direct-mode).
  Raises error — convert YAML to direct-mode first or skip entity.
- **passive addresses**: only sensor supports `passive_state_addresses` list,
  other domains ignore.
- **sensor types**: only common DPTs mapped (see `SENSOR_TYPE_TO_DPT`).
  Add yours or pass `dpt: "X.YYY"` explicitly.
- **scene**: not auto-built (rare). Add via UI.
- **expose / notify / time_server / datetime**: not auto-built.

## Backup Strategy

Each `--commit` creates timestamped `.bak.<YYYYMMDD_HHMMSS>` of:
- `H:/.storage/knx/config_store.json`
- `H:/.storage/core.entity_registry`

Backups never auto-deleted — periodically prune manually.

Restore is single-step: `restore <timestamp>` overwrites both files from backups.
