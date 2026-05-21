# WS-API Research Snapshots

Raw source files from `home-assistant/core` pulled 2026-05-21 during Plan-01 Task 15 (WS-API Discovery Spike).

**DO NOT EDIT** — these are pristine copies for reference. See `../ws-api-catalog.md` for the distilled spec.

| File | Source path | Lines |
|---|---|---|
| `websocket.py` | `homeassistant/components/knx/websocket.py` | 781 |
| `entity_store_schema.py` | `homeassistant/components/knx/storage/entity_store_schema.py` | 794 |

To refresh:
```bash
gh api repos/home-assistant/core/contents/homeassistant/components/knx/websocket.py --jq '.content' | base64 -d > websocket.py
gh api repos/home-assistant/core/contents/homeassistant/components/knx/storage/entity_store_schema.py --jq '.content' | base64 -d > entity_store_schema.py
```
