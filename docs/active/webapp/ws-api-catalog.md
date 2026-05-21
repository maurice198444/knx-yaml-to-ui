# HA-KNX WebSocket API Catalog

**Source:** `home-assistant/core` @ master, `homeassistant/components/knx/websocket.py`
**Discovered:** 2026-05-21 (Plan-01 Task 15)
**Raw snapshots:** `ws-api-research/websocket.py` (781 LOC), `ws-api-research/entity_store_schema.py` (794 LOC)

---

## 1. Implications for our App

**Major architectural confirmations:**
- HA-KNX already provides full Entity-CRUD via WS — **no `.storage` filewrites needed from our backend**.
- Bugfix #1 (`expose: []` instead of `{}`) and Bugfix #2 (entity_registry update) were CLI-specific filesystem issues — **non-issues for the App** because HA-KNX writes `.storage` itself in the correct format.
- `knx/get_knx_project` exposes `.knxproj` GA-tree → **GA-Conflict-Checker can read authoritative GA-list via WS** (no xknxproject library needed in our backend).
- `knx/subscribe_telegrams` + `knx/group_monitor_info` allow **live GA monitoring** — bonus feature for Conflict-Checker.
- `knx/validate_entity` provides **pre-flight validation** without writing — UI can validate as user types.
- `knx/get_schema` returns serialized voluptuous schema per platform → **dynamic form generation** in Frontend.

**Remaining CLI-only concerns:**
- Bugfix #3 (Umlaut-Slugify): App-relevant when generating object_id/entity_id suggestions — keep `slugify()` from `shared/knx_yaml_to_ui_core/`.
- Bugfix #4 (Areas/Floors/Labels): WS-API doesn't surface these in entity_store — handled via separate `config/area_registry/list` + `config/entity_registry/update` HA-core commands.

---

## 2. Command Catalog (21 commands)

### 2.1 Base / Discovery

| Command | Purpose | Schema | Notes |
|---|---|---|---|
| `knx/get_base_data` | Returns base config (config_entry-id, etc.) | `{ "type": "knx/get_base_data" }` | First call after WS-connect |
| `knx/get_schema` | Serialized voluptuous schema for one platform | `{ "type": ..., "platform": "light" }` | Used for dynamic form-rendering |

### 2.2 Entity CRUD (CENTRAL — our 5 features sit on top of these)

| Command | Purpose | Required Payload |
|---|---|---|
| `knx/validate_entity` | Pre-flight (no write) | `{ type, platform, data }` |
| `knx/create_entity` | Create + load entity | `{ type, platform, data }` |
| `knx/update_entity` | Update + reload entity | `{ type, platform, data, entity_id }` |
| `knx/delete_entity` | Delete + unload entity | `{ type, entity_id }` |
| `knx/get_entity_config` | Read single entity-config | `{ type, entity_id }` |
| `knx/get_entities_by_group` | List entities grouped by GA | `{ type }` |

**Payload shape `data` (for create/update/validate):**
```json
{
  "platform": "light",
  "data": {
    "entity": {
      "name": "Heizung Diele",                  // required if no device_info
      "device_info": null,                       // required if no name
      "entity_category": null                    // optional: "config" | "diagnostic" | null
    },
    "knx": {
      // platform-specific schema — fetch via knx/get_schema
      // e.g. for light:
      "ga_switch": { "write": "1/0/15", "state": "1/5/15", "passive": [] },
      "color_temperature_mode": "absolute",
      // ... see entity_store_schema.py:320 LIGHT_KNX_SCHEMA
    }
  }
}
```

**Update adds:** `"entity_id": "light.heizung_diele"` at top level.

### 2.3 Supported Platforms (13)

From `entity_store_schema.py:742 KNX_SCHEMA_FOR_PLATFORM`:
- `binary_sensor`, `climate`, `cover`, `date`, `datetime`, `fan`, `light`, `number`, `scene`, `sensor`, `switch`, `text`, `time`

**Missing vs our CLI:** none — all 9 CLI-supported domains are here, plus FAN/NUMBER/TEXT/DATE/DATETIME bonus.

### 2.4 Device

| Command | Purpose |
|---|---|
| `knx/create_device` | Create HA-device (for grouping multiple entities); returns `configuration_url=homeassistant://knx/entities/view?device_id=...` |

### 2.5 KNX-Project (xknxproj)

| Command | Purpose | Notes |
|---|---|---|
| `knx/project_file_process` | Upload `.knxproj` file | Replaces existing project |
| `knx/project_file_remove` | Remove project | |
| `knx/get_knx_project` | Get parsed GA-tree | **Key for GA-Conflict-Checker** — gives authoritative GA-list |

### 2.6 Group Monitor (live KNX bus)

| Command | Purpose | Notes |
|---|---|---|
| `knx/group_monitor_info` | Static monitor info | One-shot |
| `knx/group_telegrams` | Recent telegrams (history) | One-shot |
| `knx/subscribe_telegrams` | Live telegram stream | WS-subscription |

### 2.7 Expose (HA-state → KNX bus)

These are the `expose:` block in our CLI. **Note:** These are SEPARATE from the Entity-CRUD.

| Command | Purpose |
|---|---|
| `knx/get_expose_groups` | List exposable platforms |
| `knx/get_expose_config` | Read one expose-config |
| `knx/update_expose` | Create/update expose |
| `knx/delete_expose` | Delete expose |
| `knx/validate_expose` | Pre-flight (no write) |

### 2.8 Time Server

| Command | Purpose |
|---|---|
| `knx/get_time_server_config` | Read |
| `knx/update_time_server_config` | Write |

---

## 3. Auth + Connection

- WS Endpoint: `ws://supervisor/core/api/websocket` (from within Add-on, via SUPERVISOR_TOKEN)
- Or: `ws://<ha-host>:8123/api/websocket` (with long-lived access token)
- Standard HA-WS handshake: `auth_required` → `auth { access_token }` → `auth_ok`
- All knx/* commands require `@websocket_api.require_admin` → token must be admin.
- Supervisor-token is admin by default in Add-ons.

---

## 4. Mapping to Our 5 Features

| App Feature | WS-Commands |
|---|---|
| **YAML → UI Conversion** | per entity: `knx/validate_entity` → `knx/create_entity` |
| **UI → YAML Backup** | `knx/get_entities_by_group` → per-entity `knx/get_entity_config` |
| **GA-Conflict-Checker** | `knx/get_knx_project` (authoritative GAs from `.knxproj`) + `knx/get_entities_by_group` (used GAs) |
| **Migration-History + Rollback** | wrap our calls; store pre/post-state in our SQLite |
| **Entity-Browser + Editor** | `knx/get_entities_by_group` → `knx/get_entity_config` → edit via `knx/update_entity` |

---

## 5. Open Questions for Slice-1 (resolve before MVP)

1. **`get_entities_by_group` return shape**: line 532 says `{ str(ga): identifiers }` — what's in `identifiers`? Need to inspect at runtime (live-capture) or read `KNXModule.group_address_entities` definition.
2. **`get_entity_config` return shape**: line 554 — likely full validated payload but unconfirmed.
3. **`get_schema` return shape**: serialized voluptuous → format details TBD.
4. **WS-error response format**: do we get structured validation errors or just string `str(err)`?
5. **Entity_id generation**: who generates? Looks like `config_store.create_entity` returns the entity_id (line 438) — confirm slugify-rules match HA-core (relevant for Bugfix #3).

**Resolve plan:** live-capture via Chrome F12 on Skynet HA (Settings → Devices → KNX → Entities → create one entity manually + capture WS-frames) OR add small Python probe to call each command and dump response. Saved for early Slice-1.

---

## 6. References

- `ws-api-research/websocket.py` — full WS-handler code (snapshot)
- `ws-api-research/entity_store_schema.py` — voluptuous schemas (snapshot)
- HA core path: `homeassistant/components/knx/websocket.py`
- Storage module: `homeassistant/components/knx/storage/config_store.py` (read next when implementing Slice-1)
- HA-WS-API docs: https://developers.home-assistant.io/docs/api/websocket
