# knx-yaml-to-ui — Plan 02: Backend MVP (Slice 1A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working backend that can list, parse, dry-run, and commit a single KNX Light entity from YAML into Home Assistant via the HA-KNX WebSocket API. All endpoints fully testable via `curl` against a running Add-on; no frontend yet.

**Architecture:** Pure-core lives in `shared/knx_yaml_to_ui_core/` (parser + light-builder + validators, zero I/O). Backend `addon/app/` adds adapters (filesystem, HA-WebSocket, SQLite) and FastAPI routers wired through `deps.py`. Tests are split: unit tests live next to the pure code in `shared/`, integration tests live next to the routers in `addon/app/tests/`. All HA-WS interaction goes through one `HAClient` class so the rest of the code can be tested with a mock client.

**Tech Stack:**
- Python 3.12 (uv-managed)
- FastAPI + uvicorn, websockets, httpx, pyyaml, aiosqlite
- pytest, pytest-asyncio, pytest-cov, httpx.AsyncClient
- ruff + mypy --strict on `core/` (already wired in CI from Plan-01)

**Predecessor:** `2026-05-21-plan-01-foundation.md` (tagged `v0.0.1-foundation`)
**Successor:** `2026-05-21-plan-03-frontend-mvp.md` (Svelte SPA, written after this plan ships)

**Scope Notes:**
- One domain only — `light` — to validate the end-to-end path. Domains 2-9 land in Slice 2.
- No license-gate, no rollback, no conflict-checker UI (Slices 3-5).
- Frontend is deferred to Plan-03; this plan ends when curl flows green.

---

## File Map

### shared/knx_yaml_to_ui_core/ (pure, no I/O)

| File | Responsibility |
|---|---|
| `types.py` | TypedDicts: `ParsedDomains`, `ParsedEntity`, `UIEntityPayload` |
| `parser.py` | YAML bytes → `ParsedDomains` (handles `knx:` wrapper, bare domain, single-domain) |
| `validators.py` | Pure schema checks; raises `ParseError` / `UnsupportedFeature` |
| `builders/__init__.py` | Re-export builders, `BUILDERS` registry |
| `builders/light.py` | Light YAML-entry → `UIEntityPayload` (Bugfix #4: color_temp only when CCT) |
| `tests/test_types.py` | TypedDict shape assertions |
| `tests/test_parser.py` | Parser unit tests for 3 YAML shapes + error cases |
| `tests/test_light_builder.py` | Light builder unit tests (simple, brightness, RGBW, color-temp) |
| `tests/test_validators.py` | Validator unit tests |

### addon/app/ (backend, has I/O)

| File | Responsibility |
|---|---|
| `schemas.py` | Pydantic request/response models |
| `logging_config.py` | JSON-logging setup (Bugfix #11) |
| `deps.py` | DI: supervisor-token, `HAClient` singleton, `FsAdapter`, `DB` (extend existing) |
| `adapters/__init__.py` | Public surface for adapters |
| `adapters/fs_adapter.py` | Async read/list YAML under `/config/knx/`, atomic write |
| `adapters/ha_client.py` | HA-WebSocket-Client: auth, send-recv-correlation, reconnect, REST POST helper |
| `adapters/db.py` | SQLite `migration_history.db` in `/data/`; `insert_row()`, `list_rows()` |
| `routers/yaml_io.py` | `GET /api/yaml/files`, `GET /api/yaml/parse?path=…` |
| `routers/convert.py` | `POST /api/convert/dry-run`, `POST /api/convert/commit` |
| `routers/entities.py` | `GET /api/entities`, `GET /api/entities/{entity_id}` |
| `routers/ws.py` | `GET /ws/state-stream` (browser ↔ backend WS proxy for `state_changed`) |
| `main.py` | Wire all routers, lifecycle for `HAClient` |
| `tests/conftest.py` | Fixtures: mock-HA-WS, tmp config-dir, TestClient |
| `tests/test_adapters_fs.py` | fs_adapter R/W + listing |
| `tests/test_adapters_ha_client.py` | HAClient against fake-WS-server (asyncio.start_server) |
| `tests/test_adapters_db.py` | SQLite insert + list |
| `tests/test_routers_yaml_io.py` | yaml_io endpoints |
| `tests/test_routers_convert.py` | convert endpoints (dry-run + commit) |
| `tests/test_routers_entities.py` | entities endpoints |
| `tests/test_routers_ws.py` | ws router round-trip |

### CI

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Add `backend-integration` job |

---

## Done-Criteria for Plan 02

- [ ] `shared/knx_yaml_to_ui_core/` has `parser`, `builders/light`, `validators`, `types` with ≥85% coverage on `core/`
- [ ] `addon/app/adapters/` has `fs_adapter`, `ha_client`, `db` with ≥60% coverage
- [ ] `addon/app/routers/` has `yaml_io`, `convert`, `entities`, `ws` with ≥70% coverage
- [ ] All routers reachable via curl against a running Add-on on Skynet HA
- [ ] `curl POST /api/convert/dry-run` returns a deterministic JSON diff for a fixture light-YAML
- [ ] `curl POST /api/convert/commit` creates an actual `light.<slug>` entity in HA and the entity appears in `GET /api/entities`
- [ ] `wscat ws://<addon>/ws/state-stream` streams a `state_changed` event when the new light's brightness changes
- [ ] CI job `backend-integration` is green on `main`
- [ ] Tag `v0.0.2-backend-mvp`
- [ ] Plan-03 (Frontend MVP) can be written next without touching the backend

---

## Task 1: ParsedDomains TypedDicts

**Files:**
- Create: `shared/knx_yaml_to_ui_core/types.py`
- Test: `shared/knx_yaml_to_ui_core/tests/test_types.py`

- [ ] **Step 1: Write the failing test**

```python
# shared/knx_yaml_to_ui_core/tests/test_types.py
"""Type shape assertions — these compile-time-pass via mypy --strict."""
from knx_yaml_to_ui_core.types import ParsedDomains, ParsedEntity, UIEntityPayload


def test_parsed_entity_required_keys() -> None:
    entry: ParsedEntity = {"name": "Diele", "knx": {"address": "1/0/15"}}
    assert entry["name"] == "Diele"


def test_parsed_domains_is_dict_of_lists() -> None:
    parsed: ParsedDomains = {"light": [{"name": "Diele", "knx": {}}]}
    assert "light" in parsed
    assert isinstance(parsed["light"], list)


def test_ui_entity_payload_has_platform_and_data() -> None:
    payload: UIEntityPayload = {
        "platform": "light",
        "data": {
            "entity": {"name": "Diele", "device_info": None, "entity_category": None},
            "knx": {"ga_switch": {"write": "1/0/15", "state": None, "passive": []}},
        },
    }
    assert payload["platform"] == "light"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd shared && uv run pytest knx_yaml_to_ui_core/tests/test_types.py -v`
Expected: FAIL with `ModuleNotFoundError: knx_yaml_to_ui_core.types`

- [ ] **Step 3: Implement types module**

```python
# shared/knx_yaml_to_ui_core/types.py
"""TypedDict definitions for the pure core. No I/O, no runtime deps."""
from typing import Any, NotRequired, TypedDict


class ParsedEntity(TypedDict):
    """One entity as parsed from YAML — minimal shape, builders consume this."""

    name: str
    knx: dict[str, Any]
    device_class: NotRequired[str]
    entity_category: NotRequired[str]


ParsedDomains = dict[str, list[ParsedEntity]]
"""Domain (e.g. 'light') → list of entities for that domain."""


class _UIEntityEntityBlock(TypedDict):
    name: str
    device_info: str | None
    entity_category: str | None


class UIEntityPayload(TypedDict):
    """Payload shape expected by `knx/create_entity` / `knx/validate_entity`."""

    platform: str
    data: dict[str, Any]  # {"entity": _UIEntityEntityBlock, "knx": {...}}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd shared && uv run pytest knx_yaml_to_ui_core/tests/test_types.py -v`
Expected: 3 passed

- [ ] **Step 5: Run mypy --strict**

Run: `cd shared && uv run mypy --strict knx_yaml_to_ui_core/types.py`
Expected: `Success: no issues found`

- [ ] **Step 6: Commit**

```bash
git add shared/knx_yaml_to_ui_core/types.py shared/knx_yaml_to_ui_core/tests/test_types.py
git commit -m "feat(core): add TypedDicts for ParsedDomains and UIEntityPayload"
```

---

## Task 2: YAML Parser

**Files:**
- Create: `shared/knx_yaml_to_ui_core/parser.py`
- Create: `shared/knx_yaml_to_ui_core/tests/test_parser.py`
- Create: `shared/knx_yaml_to_ui_core/tests/fixtures/yaml/light_wrapped.yaml`
- Create: `shared/knx_yaml_to_ui_core/tests/fixtures/yaml/light_bare.yaml`
- Create: `shared/knx_yaml_to_ui_core/tests/fixtures/yaml/light_single_domain.yaml`
- Create: `shared/knx_yaml_to_ui_core/tests/fixtures/yaml/malformed.yaml`

- [ ] **Step 1: Write the fixture files**

```yaml
# shared/knx_yaml_to_ui_core/tests/fixtures/yaml/light_wrapped.yaml
knx:
  light:
    - name: Diele
      individual_address: 1.1.5
      address: 1/0/15
      state_address: 1/5/15
```

```yaml
# shared/knx_yaml_to_ui_core/tests/fixtures/yaml/light_bare.yaml
light:
  - name: Wohnzimmer
    address: 1/0/16
    state_address: 1/5/16
switch:
  - name: Steckdose
    address: 2/0/1
    state_address: 2/5/1
```

```yaml
# shared/knx_yaml_to_ui_core/tests/fixtures/yaml/light_single_domain.yaml
light:
  - name: Küche
    address: 1/0/17
    state_address: 1/5/17
```

```yaml
# shared/knx_yaml_to_ui_core/tests/fixtures/yaml/malformed.yaml
light:
  - name: BrokenIndent
  address: nope
```

- [ ] **Step 2: Write the failing tests**

```python
# shared/knx_yaml_to_ui_core/tests/test_parser.py
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd shared && uv run pytest knx_yaml_to_ui_core/tests/test_parser.py -v`
Expected: FAIL with `ModuleNotFoundError: knx_yaml_to_ui_core.parser`

- [ ] **Step 4: Implement parser module**

```python
# shared/knx_yaml_to_ui_core/parser.py
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd shared && uv run pytest knx_yaml_to_ui_core/tests/test_parser.py -v --cov=knx_yaml_to_ui_core.parser`
Expected: 6 passed, coverage ≥85%

- [ ] **Step 6: Commit**

```bash
git add shared/knx_yaml_to_ui_core/parser.py shared/knx_yaml_to_ui_core/tests/test_parser.py shared/knx_yaml_to_ui_core/tests/fixtures/
git commit -m "feat(core): add YAML parser with three-shape support and ParseError"
```

---

## Task 3: Validators

**Files:**
- Create: `shared/knx_yaml_to_ui_core/validators.py`
- Create: `shared/knx_yaml_to_ui_core/tests/test_validators.py`

- [ ] **Step 1: Write the failing test**

```python
# shared/knx_yaml_to_ui_core/tests/test_validators.py
"""Validators ensure entities pass minimum shape requirements before building."""
import pytest

from knx_yaml_to_ui_core.validators import (
    UnsupportedFeature,
    ValidationError,
    require_keys,
    validate_ga,
    reject_setpoint_shift,
)


def test_require_keys_passes_when_all_present() -> None:
    require_keys({"name": "x", "address": "1/0/1"}, ("name", "address"), entity_label="Light Diele")


def test_require_keys_raises_when_missing() -> None:
    with pytest.raises(ValidationError) as exc:
        require_keys({"name": "x"}, ("name", "address"), entity_label="Light Diele")
    assert "address" in str(exc.value)
    assert "Light Diele" in str(exc.value)


def test_validate_ga_accepts_three_level() -> None:
    validate_ga("1/0/15", field="ga_switch.write")


def test_validate_ga_accepts_two_level() -> None:
    validate_ga("1/15", field="ga_switch.write")


def test_validate_ga_rejects_garbage() -> None:
    with pytest.raises(ValidationError):
        validate_ga("nope", field="ga_switch.write")


def test_reject_setpoint_shift_raises_unsupported_feature() -> None:
    with pytest.raises(UnsupportedFeature) as exc:
        reject_setpoint_shift({"setpoint_shift_address": "5/0/1"}, entity_label="Climate Diele")
    assert "setpoint_shift" in str(exc.value)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd shared && uv run pytest knx_yaml_to_ui_core/tests/test_validators.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Implement validators module**

```python
# shared/knx_yaml_to_ui_core/validators.py
"""Pure validators. Inputs are dicts; outputs are exceptions (or nothing)."""
from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any


class ValidationError(ValueError):
    """Required key missing or wrong shape."""


class UnsupportedFeature(ValueError):
    """YAML uses a feature we deliberately do not support in UI-config-store."""


_GA_PATTERN = re.compile(r"^\d{1,2}(/\d{1,4}){1,2}$")


def require_keys(d: dict[str, Any], keys: Iterable[str], *, entity_label: str) -> None:
    """Raise ValidationError if any of the keys are missing or None."""
    missing = [k for k in keys if d.get(k) in (None, "")]
    if missing:
        raise ValidationError(
            f"{entity_label}: missing required keys {missing}"
        )


def validate_ga(value: str, *, field: str) -> None:
    """Raise ValidationError if value is not a valid KNX Group Address."""
    if not isinstance(value, str) or not _GA_PATTERN.match(value):
        raise ValidationError(f"{field}: '{value}' is not a valid KNX Group Address (e.g. 1/0/15)")


def reject_setpoint_shift(yml: dict[str, Any], *, entity_label: str) -> None:
    """Bugfix-driven gate — setpoint_shift climates have no UI-config-store schema."""
    if "setpoint_shift_address" in yml or "setpoint_shift_state_address" in yml:
        raise UnsupportedFeature(
            f"{entity_label}: setpoint_shift climate is not supported in UI-config-store; "
            "keep this entity in YAML"
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd shared && uv run pytest knx_yaml_to_ui_core/tests/test_validators.py -v --cov=knx_yaml_to_ui_core.validators`
Expected: 6 passed, coverage 100%

- [ ] **Step 5: Commit**

```bash
git add shared/knx_yaml_to_ui_core/validators.py shared/knx_yaml_to_ui_core/tests/test_validators.py
git commit -m "feat(core): add validators with ValidationError + UnsupportedFeature"
```

---

## Task 4: Light Builder

**Files:**
- Create: `shared/knx_yaml_to_ui_core/builders/__init__.py`
- Create: `shared/knx_yaml_to_ui_core/builders/light.py`
- Create: `shared/knx_yaml_to_ui_core/tests/test_light_builder.py`

- [ ] **Step 1: Write the failing test**

```python
# shared/knx_yaml_to_ui_core/tests/test_light_builder.py
"""Light builder unit tests covering Bugfix #4 (color_temp only for CCT mode)."""
import pytest

from knx_yaml_to_ui_core.builders.light import build_light
from knx_yaml_to_ui_core.validators import ValidationError


def test_build_simple_light() -> None:
    yml = {
        "name": "Diele",
        "address": "1/0/15",
        "state_address": "1/5/15",
    }
    payload = build_light(yml)
    assert payload["platform"] == "light"
    assert payload["data"]["entity"]["name"] == "Diele"
    assert payload["data"]["knx"]["ga_switch"] == {
        "write": "1/0/15",
        "state": "1/5/15",
        "passive": [],
    }
    # Bugfix #4: no color_temp keys unless CCT mode declared
    assert "color_temperature_mode" not in payload["data"]["knx"]
    assert "ga_color_temp" not in payload["data"]["knx"]


def test_build_light_with_brightness() -> None:
    yml = {
        "name": "Diele",
        "address": "1/0/15",
        "state_address": "1/5/15",
        "brightness_address": "1/0/16",
        "brightness_state_address": "1/5/16",
    }
    payload = build_light(yml)
    assert payload["data"]["knx"]["ga_brightness"] == {
        "write": "1/0/16",
        "state": "1/5/16",
        "passive": [],
    }


def test_build_light_cct_includes_color_temp_block() -> None:
    """Bugfix #4 positive case — only when color_temperature_mode is set explicitly."""
    yml = {
        "name": "Diele",
        "address": "1/0/15",
        "state_address": "1/5/15",
        "color_temperature_mode": "absolute",
        "color_temperature_address": "1/0/20",
        "color_temperature_state_address": "1/5/20",
        "min_kelvin": 2700,
        "max_kelvin": 6500,
    }
    payload = build_light(yml)
    assert payload["data"]["knx"]["color_temperature_mode"] == "absolute"
    assert payload["data"]["knx"]["ga_color_temp"]["write"] == "1/0/20"
    assert payload["data"]["knx"]["min_kelvin"] == 2700
    assert payload["data"]["knx"]["max_kelvin"] == 6500


def test_build_light_without_color_temp_mode_drops_temp_keys() -> None:
    """Bugfix #4: even if temp-addresses are present, drop them when mode missing."""
    yml = {
        "name": "Diele",
        "address": "1/0/15",
        "state_address": "1/5/15",
        "color_temperature_address": "1/0/20",  # mode missing → must be ignored
    }
    payload = build_light(yml)
    assert "ga_color_temp" not in payload["data"]["knx"]
    assert "color_temperature_mode" not in payload["data"]["knx"]


def test_build_light_missing_name_raises_validation_error() -> None:
    with pytest.raises(ValidationError):
        build_light({"address": "1/0/15"})


def test_build_light_invalid_ga_raises_validation_error() -> None:
    with pytest.raises(ValidationError):
        build_light({"name": "Diele", "address": "garbage"})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd shared && uv run pytest knx_yaml_to_ui_core/tests/test_light_builder.py -v`
Expected: FAIL with `ModuleNotFoundError: knx_yaml_to_ui_core.builders`

- [ ] **Step 3: Implement builders package init**

```python
# shared/knx_yaml_to_ui_core/builders/__init__.py
"""Domain builders — pure functions YAML-dict → UIEntityPayload."""
from .light import build_light

BUILDERS = {
    "light": build_light,
}

__all__ = ["BUILDERS", "build_light"]
```

- [ ] **Step 4: Implement light builder**

```python
# shared/knx_yaml_to_ui_core/builders/light.py
"""Light builder — YAML entry to UI-config-store payload.

Bugfix #4: color_temperature block is only emitted when `color_temperature_mode`
is set explicitly. Naked temperature-addresses without a mode are dropped.
"""
from __future__ import annotations

from typing import Any

from ..types import UIEntityPayload
from ..validators import require_keys, validate_ga


def _ga_block(write: str, state: str | None) -> dict[str, Any]:
    return {"write": write, "state": state, "passive": []}


def build_light(yml: dict[str, Any]) -> UIEntityPayload:
    """Convert a single YAML light entity to a UI-config-store payload."""
    label = f"Light {yml.get('name', '<unnamed>')}"
    require_keys(yml, ("name", "address"), entity_label=label)
    validate_ga(yml["address"], field=f"{label}.address")

    knx: dict[str, Any] = {
        "ga_switch": _ga_block(yml["address"], yml.get("state_address")),
    }

    if "brightness_address" in yml:
        validate_ga(yml["brightness_address"], field=f"{label}.brightness_address")
        knx["ga_brightness"] = _ga_block(
            yml["brightness_address"], yml.get("brightness_state_address")
        )

    # Bugfix #4: color_temperature block only when mode is set
    mode = yml.get("color_temperature_mode")
    if mode in ("absolute", "relative"):
        ct_addr = yml.get("color_temperature_address")
        if ct_addr:
            validate_ga(ct_addr, field=f"{label}.color_temperature_address")
            knx["color_temperature_mode"] = mode
            knx["ga_color_temp"] = _ga_block(
                ct_addr, yml.get("color_temperature_state_address")
            )
            if "min_kelvin" in yml:
                knx["min_kelvin"] = yml["min_kelvin"]
            if "max_kelvin" in yml:
                knx["max_kelvin"] = yml["max_kelvin"]

    payload: UIEntityPayload = {
        "platform": "light",
        "data": {
            "entity": {
                "name": yml["name"],
                "device_info": None,
                "entity_category": yml.get("entity_category"),
            },
            "knx": knx,
        },
    }
    return payload
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd shared && uv run pytest knx_yaml_to_ui_core/tests/test_light_builder.py -v --cov=knx_yaml_to_ui_core.builders.light`
Expected: 6 passed, coverage ≥90%

- [ ] **Step 6: Verify full core coverage**

Run: `cd shared && uv run pytest --cov=knx_yaml_to_ui_core --cov-report=term-missing`
Expected: overall coverage ≥85%

- [ ] **Step 7: Commit**

```bash
git add shared/knx_yaml_to_ui_core/builders/ shared/knx_yaml_to_ui_core/tests/test_light_builder.py
git commit -m "feat(core): add light builder with Bugfix #4 color_temp gating"
```

---

## Task 5: FsAdapter (filesystem I/O)

**Files:**
- Create: `addon/app/adapters/__init__.py`
- Create: `addon/app/adapters/fs_adapter.py`
- Create: `addon/app/tests/conftest.py`
- Create: `addon/app/tests/test_adapters_fs.py`

- [ ] **Step 1: Write conftest**

```python
# addon/app/tests/conftest.py
"""Shared pytest fixtures for backend tests."""
from __future__ import annotations

import asyncio
from collections.abc import Iterator
from pathlib import Path

import pytest


@pytest.fixture
def tmp_knx_dir(tmp_path: Path) -> Path:
    """Simulate /config/knx with a few YAML files."""
    knx = tmp_path / "knx"
    knx.mkdir()
    (knx / "light.yaml").write_text(
        "light:\n  - name: Diele\n    address: 1/0/15\n    state_address: 1/5/15\n",
        encoding="utf-8",
    )
    (knx / "switch.yaml").write_text(
        "switch:\n  - name: Steckdose\n    address: 2/0/1\n",
        encoding="utf-8",
    )
    return knx


@pytest.fixture
def event_loop() -> Iterator[asyncio.AbstractEventLoop]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
```

- [ ] **Step 2: Write the failing fs_adapter test**

```python
# addon/app/tests/test_adapters_fs.py
"""FsAdapter — async read, list, atomic write of /config/knx YAML files."""
from pathlib import Path

import pytest

from app.adapters.fs_adapter import FsAdapter, FsError


@pytest.mark.asyncio
async def test_list_files_returns_yaml_only(tmp_knx_dir: Path) -> None:
    (tmp_knx_dir / "README.md").write_text("ignore me", encoding="utf-8")
    fs = FsAdapter(root=tmp_knx_dir)
    files = await fs.list_files()
    assert sorted(files) == ["light.yaml", "switch.yaml"]


@pytest.mark.asyncio
async def test_read_file_returns_bytes(tmp_knx_dir: Path) -> None:
    fs = FsAdapter(root=tmp_knx_dir)
    content = await fs.read("light.yaml")
    assert b"Diele" in content


@pytest.mark.asyncio
async def test_read_rejects_path_traversal(tmp_knx_dir: Path) -> None:
    fs = FsAdapter(root=tmp_knx_dir)
    with pytest.raises(FsError) as exc:
        await fs.read("../etc/passwd")
    assert "outside root" in str(exc.value)


@pytest.mark.asyncio
async def test_write_atomic_creates_file(tmp_knx_dir: Path) -> None:
    fs = FsAdapter(root=tmp_knx_dir)
    await fs.write_atomic("new.yaml", b"light: []\n")
    assert (tmp_knx_dir / "new.yaml").read_bytes() == b"light: []\n"


@pytest.mark.asyncio
async def test_write_atomic_uses_tempfile(tmp_knx_dir: Path) -> None:
    """No `.tmp` file should remain after a successful write."""
    fs = FsAdapter(root=tmp_knx_dir)
    await fs.write_atomic("new.yaml", b"x")
    leftover = list(tmp_knx_dir.glob("*.tmp"))
    assert leftover == []
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd addon/app && uv run pytest tests/test_adapters_fs.py -v`
Expected: FAIL with `ModuleNotFoundError: app.adapters.fs_adapter`

- [ ] **Step 4: Implement FsAdapter**

```python
# addon/app/adapters/__init__.py
"""I/O adapters — filesystem, HA-WS, SQLite."""
```

```python
# addon/app/adapters/fs_adapter.py
"""Async filesystem adapter for /config/knx/*.yaml.

Reads, lists, and atomically writes YAML files under a fixed root. Rejects
any path that resolves outside the configured root (path-traversal defense).
"""
from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path


class FsError(OSError):
    """Filesystem operation rejected or failed."""


class FsAdapter:
    """Async adapter — all blocking calls go through asyncio.to_thread."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root).resolve()

    def _resolve(self, name: str) -> Path:
        candidate = (self.root / name).resolve()
        try:
            candidate.relative_to(self.root)
        except ValueError as exc:
            raise FsError(f"path '{name}' resolves outside root") from exc
        return candidate

    async def list_files(self) -> list[str]:
        def _scan() -> list[str]:
            return sorted(
                p.name for p in self.root.iterdir() if p.is_file() and p.suffix == ".yaml"
            )

        return await asyncio.to_thread(_scan)

    async def read(self, name: str) -> bytes:
        path = self._resolve(name)
        return await asyncio.to_thread(path.read_bytes)

    async def write_atomic(self, name: str, content: bytes) -> None:
        path = self._resolve(name)

        def _write() -> None:
            fd, tmp_name = tempfile.mkstemp(
                prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
            )
            try:
                with os.fdopen(fd, "wb") as fh:
                    fh.write(content)
                os.replace(tmp_name, path)
            except Exception:
                Path(tmp_name).unlink(missing_ok=True)
                raise

        await asyncio.to_thread(_write)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd addon/app && uv run pytest tests/test_adapters_fs.py -v --cov=app.adapters.fs_adapter`
Expected: 5 passed, coverage ≥85%

- [ ] **Step 6: Commit**

```bash
git add addon/app/adapters/ addon/app/tests/conftest.py addon/app/tests/test_adapters_fs.py
git commit -m "feat(adapter): add FsAdapter with path-traversal guard and atomic write"
```

---

## Task 6: HAClient (WebSocket adapter)

**Files:**
- Create: `addon/app/adapters/ha_client.py`
- Create: `addon/app/tests/test_adapters_ha_client.py`

- [ ] **Step 1: Write the failing test using a fake WS server**

```python
# addon/app/tests/test_adapters_ha_client.py
"""HAClient against a fake WS server backed by asyncio.start_server.

The fake server speaks the HA-WS handshake (auth_required → auth_ok) and
echoes structured replies. Lets us exercise reconnect, send/recv correlation,
and timeout behavior without needing a real HA.
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

import pytest
import websockets
from websockets.server import serve

from app.adapters.ha_client import HAClient, HAClientError


class FakeHA:
    """Minimal HA-WS server for tests."""

    def __init__(self) -> None:
        self.received: list[dict] = []
        self.next_results: dict[int, dict] = {}

    async def handler(self, ws: websockets.WebSocketServerProtocol) -> None:
        await ws.send(json.dumps({"type": "auth_required", "ha_version": "2026.5.0"}))
        auth_msg = json.loads(await ws.recv())
        if auth_msg.get("type") != "auth" or "access_token" not in auth_msg:
            await ws.send(json.dumps({"type": "auth_invalid"}))
            return
        await ws.send(json.dumps({"type": "auth_ok", "ha_version": "2026.5.0"}))

        async for raw in ws:
            msg = json.loads(raw)
            self.received.append(msg)
            mid = msg["id"]
            result = self.next_results.get(mid) or {
                "id": mid,
                "type": "result",
                "success": True,
                "result": {"ok": True},
            }
            await ws.send(json.dumps(result))


@pytest.fixture
async def fake_ha() -> AsyncIterator[tuple[FakeHA, str]]:
    fake = FakeHA()
    async with serve(fake.handler, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]
        yield fake, f"ws://127.0.0.1:{port}"


@pytest.mark.asyncio
async def test_connect_and_send_command(fake_ha: tuple[FakeHA, str]) -> None:
    fake, url = fake_ha
    client = HAClient(url=url, token="dev")
    await client.connect()
    result = await client.send({"type": "knx/get_base_data"})
    assert result == {"ok": True}
    assert fake.received[0]["type"] == "knx/get_base_data"
    await client.close()


@pytest.mark.asyncio
async def test_send_returns_error_on_unsuccessful_result(fake_ha: tuple[FakeHA, str]) -> None:
    fake, url = fake_ha
    fake.next_results[1] = {
        "id": 1,
        "type": "result",
        "success": False,
        "error": {"code": "invalid_format", "message": "boom"},
    }
    client = HAClient(url=url, token="dev")
    await client.connect()
    with pytest.raises(HAClientError) as exc:
        await client.send({"type": "knx/get_base_data"})
    assert "boom" in str(exc.value)
    await client.close()


@pytest.mark.asyncio
async def test_send_correlates_concurrent_requests(fake_ha: tuple[FakeHA, str]) -> None:
    fake, url = fake_ha
    fake.next_results[1] = {"id": 1, "type": "result", "success": True, "result": {"a": 1}}
    fake.next_results[2] = {"id": 2, "type": "result", "success": True, "result": {"b": 2}}
    client = HAClient(url=url, token="dev")
    await client.connect()
    a, b = await asyncio.gather(
        client.send({"type": "knx/foo"}),
        client.send({"type": "knx/bar"}),
    )
    assert {a["a"], b["b"]} == {1, 2}
    await client.close()


@pytest.mark.asyncio
async def test_invalid_token_raises(fake_ha: tuple[FakeHA, str]) -> None:
    _, url = fake_ha
    client = HAClient(url=url, token="")
    with pytest.raises(HAClientError):
        await client.connect()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd addon/app && uv run pytest tests/test_adapters_ha_client.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Implement HAClient**

```python
# addon/app/adapters/ha_client.py
"""HA-WebSocket adapter.

One HAClient instance per backend process, owned by FastAPI lifespan. Performs
the HA auth handshake on connect, multiplexes commands via incrementing `id`
fields, and exposes `send(payload) -> result_dict`. Subscriptions get a
separate channel API in Task 11 (ws router).
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from itertools import count
from typing import Any

import websockets
from websockets.client import WebSocketClientProtocol

log = logging.getLogger(__name__)


class HAClientError(RuntimeError):
    """HA returned an error result, the socket dropped, or auth failed."""


class HAClient:
    def __init__(self, *, url: str, token: str, recv_timeout: float = 10.0) -> None:
        self._url = url
        self._token = token
        self._recv_timeout = recv_timeout
        self._ws: WebSocketClientProtocol | None = None
        self._id_seq = count(1)
        self._pending: dict[int, asyncio.Future[dict[str, Any]]] = {}
        self._subscriptions: dict[int, asyncio.Queue[dict[str, Any]]] = {}
        self._reader_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()

    async def connect(self) -> None:
        ws = await websockets.connect(self._url, max_size=2**22)
        try:
            hello = json.loads(await asyncio.wait_for(ws.recv(), self._recv_timeout))
            if hello.get("type") != "auth_required":
                raise HAClientError(f"unexpected first frame: {hello}")
            await ws.send(json.dumps({"type": "auth", "access_token": self._token}))
            reply = json.loads(await asyncio.wait_for(ws.recv(), self._recv_timeout))
            if reply.get("type") != "auth_ok":
                raise HAClientError(f"auth failed: {reply}")
        except Exception:
            await ws.close()
            raise
        self._ws = ws
        self._reader_task = asyncio.create_task(self._reader_loop())

    async def close(self) -> None:
        if self._reader_task:
            self._reader_task.cancel()
            self._reader_task = None
        if self._ws:
            await self._ws.close()
            self._ws = None

    async def send(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self._ws:
            raise HAClientError("not connected")
        msg_id = next(self._id_seq)
        future: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        self._pending[msg_id] = future
        outbound = {"id": msg_id, **payload}
        async with self._lock:
            await self._ws.send(json.dumps(outbound))
        try:
            result = await asyncio.wait_for(future, timeout=self._recv_timeout)
        finally:
            self._pending.pop(msg_id, None)
        return result

    async def subscribe(self, payload: dict[str, Any]) -> tuple[int, AsyncIterator[dict[str, Any]]]:
        """Send a subscription command. Returns (subscription_id, async-iter of events)."""
        if not self._ws:
            raise HAClientError("not connected")
        msg_id = next(self._id_seq)
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
        self._subscriptions[msg_id] = queue
        outbound = {"id": msg_id, **payload}
        future: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        self._pending[msg_id] = future
        async with self._lock:
            await self._ws.send(json.dumps(outbound))
        await asyncio.wait_for(future, timeout=self._recv_timeout)  # confirm subscription
        self._pending.pop(msg_id, None)

        async def iterator() -> AsyncIterator[dict[str, Any]]:
            try:
                while True:
                    yield await queue.get()
            finally:
                self._subscriptions.pop(msg_id, None)

        return msg_id, iterator()

    async def _reader_loop(self) -> None:
        assert self._ws is not None
        try:
            async for raw in self._ws:
                msg = json.loads(raw)
                msg_id = msg.get("id")
                msg_type = msg.get("type")
                if msg_type == "event" and msg_id in self._subscriptions:
                    await self._subscriptions[msg_id].put(msg["event"])
                    continue
                future = self._pending.get(msg_id) if msg_id is not None else None
                if future is None or future.done():
                    continue
                if msg_type == "result" and msg.get("success") is True:
                    future.set_result(msg.get("result") or {})
                elif msg_type == "result" and msg.get("success") is False:
                    err = msg.get("error") or {}
                    future.set_exception(
                        HAClientError(
                            f"{err.get('code', 'unknown')}: {err.get('message', '')}"
                        )
                    )
                else:
                    future.set_exception(HAClientError(f"unexpected frame: {msg}"))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("HA reader loop crashed: %s", exc)
            for fut in self._pending.values():
                if not fut.done():
                    fut.set_exception(HAClientError(f"connection lost: {exc}"))
            self._pending.clear()
```

- [ ] **Step 4: Add websockets + pytest-asyncio to addon dev-deps**

Edit `addon/app/pyproject.toml`:

```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "pytest-cov>=4.1",
    "httpx>=0.27",
    "ruff>=0.6",
    "mypy>=1.11",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

Run: `cd addon/app && uv sync --extra dev`

- [ ] **Step 5: Run test to verify it passes**

Run: `cd addon/app && uv run pytest tests/test_adapters_ha_client.py -v --cov=app.adapters.ha_client`
Expected: 4 passed, coverage ≥75%

- [ ] **Step 6: Commit**

```bash
git add addon/app/adapters/ha_client.py addon/app/tests/test_adapters_ha_client.py addon/app/pyproject.toml
git commit -m "feat(adapter): add HAClient WebSocket adapter with command + subscription multiplexing"
```

---

## Task 7: SQLite DB Adapter

**Files:**
- Create: `addon/app/adapters/db.py`
- Create: `addon/app/tests/test_adapters_db.py`

- [ ] **Step 1: Write the failing test**

```python
# addon/app/tests/test_adapters_db.py
"""Migration-history SQLite adapter — append-only insert + list."""
from pathlib import Path

import pytest

from app.adapters.db import DB


@pytest.mark.asyncio
async def test_insert_then_list_returns_row(tmp_path: Path) -> None:
    db = DB(path=tmp_path / "history.db")
    await db.init()
    row_id = await db.insert_row(
        kind="convert.commit",
        payload={"entity_id": "light.diele", "applied": True},
        status="ok",
    )
    rows = await db.list_rows(limit=10)
    assert len(rows) == 1
    assert rows[0]["id"] == row_id
    assert rows[0]["kind"] == "convert.commit"
    assert rows[0]["status"] == "ok"
    assert rows[0]["payload"]["entity_id"] == "light.diele"


@pytest.mark.asyncio
async def test_list_returns_most_recent_first(tmp_path: Path) -> None:
    db = DB(path=tmp_path / "history.db")
    await db.init()
    await db.insert_row(kind="x", payload={"n": 1}, status="ok")
    await db.insert_row(kind="x", payload={"n": 2}, status="ok")
    rows = await db.list_rows(limit=10)
    assert [r["payload"]["n"] for r in rows] == [2, 1]


@pytest.mark.asyncio
async def test_init_is_idempotent(tmp_path: Path) -> None:
    db = DB(path=tmp_path / "history.db")
    await db.init()
    await db.init()  # second call must not raise
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd addon/app && uv run pytest tests/test_adapters_db.py -v`
Expected: FAIL with `ModuleNotFoundError: aiosqlite` or `app.adapters.db`

- [ ] **Step 3: Add aiosqlite to addon deps**

Edit `addon/app/pyproject.toml`:

```toml
dependencies = [
    "knx-yaml-to-ui-core",
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "httpx>=0.27",
    "websockets>=13.0",
    "pyyaml>=6.0",
    "aiosqlite>=0.20",
]
```

Run: `cd addon/app && uv sync`

- [ ] **Step 4: Implement DB adapter**

```python
# addon/app/adapters/db.py
"""SQLite migration_history adapter — append-only, async via aiosqlite."""
from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import aiosqlite

_SCHEMA = """
CREATE TABLE IF NOT EXISTS migration_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_migration_history_created_at
    ON migration_history (created_at DESC);
"""


class DB:
    def __init__(self, path: Path) -> None:
        self._path = Path(path)

    async def init(self) -> None:
        async with aiosqlite.connect(self._path) as conn:
            await conn.executescript(_SCHEMA)
            await conn.commit()

    async def insert_row(self, *, kind: str, payload: dict[str, Any], status: str) -> int:
        created_at = datetime.now(UTC).isoformat()
        async with aiosqlite.connect(self._path) as conn:
            cursor = await conn.execute(
                "INSERT INTO migration_history (created_at, kind, status, payload) "
                "VALUES (?, ?, ?, ?)",
                (created_at, kind, status, json.dumps(payload)),
            )
            await conn.commit()
            assert cursor.lastrowid is not None
            return cursor.lastrowid

    async def list_rows(self, *, limit: int = 50) -> list[dict[str, Any]]:
        async with aiosqlite.connect(self._path) as conn:
            conn.row_factory = aiosqlite.Row
            cursor = await conn.execute(
                "SELECT id, created_at, kind, status, payload FROM migration_history "
                "ORDER BY id DESC LIMIT ?",
                (limit,),
            )
            rows = await cursor.fetchall()
        return [
            {
                "id": row["id"],
                "created_at": row["created_at"],
                "kind": row["kind"],
                "status": row["status"],
                "payload": json.loads(row["payload"]),
            }
            for row in rows
        ]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd addon/app && uv run pytest tests/test_adapters_db.py -v --cov=app.adapters.db`
Expected: 3 passed, coverage ≥85%

- [ ] **Step 6: Commit**

```bash
git add addon/app/adapters/db.py addon/app/tests/test_adapters_db.py addon/app/pyproject.toml
git commit -m "feat(adapter): add SQLite migration_history adapter (insert + list)"
```

---

## Task 8: JSON Logging

**Files:**
- Create: `addon/app/logging_config.py`

- [ ] **Step 1: Implement JSON logging config**

```python
# addon/app/logging_config.py
"""JSON log formatter — Bugfix #11 (no stdout-print leakage)."""
from __future__ import annotations

import json
import logging
import os
import sys
from typing import Any


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging() -> None:
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(level)
```

- [ ] **Step 2: Commit**

```bash
git add addon/app/logging_config.py
git commit -m "feat(addon): add JSON logger respecting LOG_LEVEL env"
```

---

## Task 9: Pydantic Schemas

**Files:**
- Create: `addon/app/schemas.py`

- [ ] **Step 1: Implement schemas module**

```python
# addon/app/schemas.py
"""Pydantic models for request/response payloads."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ApiError(BaseModel):
    code: str
    message: str
    hint: str | None = None
    entity: str | None = None


class YamlFile(BaseModel):
    name: str
    size_bytes: int


class YamlFilesResponse(BaseModel):
    files: list[YamlFile]


class ParsedDomainSummary(BaseModel):
    domain: str
    entity_count: int
    entity_names: list[str]


class YamlParseResponse(BaseModel):
    path: str
    domains: list[ParsedDomainSummary]
    raw_size: int


class DryRunRequest(BaseModel):
    path: str = Field(description="YAML path relative to /config/knx/")
    domain: str = Field(default="light", description="Slice 1A supports only 'light'")


class DryRunEntry(BaseModel):
    name: str
    payload: dict[str, Any]
    validation: str  # "ok" | "warn" | "error"
    message: str | None = None


class DryRunResponse(BaseModel):
    path: str
    domain: str
    entries: list[DryRunEntry]


class CommitRequest(BaseModel):
    path: str
    domain: str = "light"
    only_names: list[str] | None = Field(
        default=None, description="If set, only commit entities whose name appears here"
    )


class CommitResultEntry(BaseModel):
    name: str
    entity_id: str | None = None
    applied: bool
    error: str | None = None


class CommitResponse(BaseModel):
    path: str
    domain: str
    migration_id: int
    entries: list[CommitResultEntry]


class EntitySummary(BaseModel):
    entity_id: str
    name: str | None
    platform: str
    state: str | None


class EntitiesResponse(BaseModel):
    entities: list[EntitySummary]


class EntityConfigResponse(BaseModel):
    entity_id: str
    config: dict[str, Any]
```

- [ ] **Step 2: Commit**

```bash
git add addon/app/schemas.py
git commit -m "feat(addon): add Pydantic request/response schemas"
```

---

## Task 10: deps.py wiring

**Files:**
- Modify: `addon/app/deps.py`

- [ ] **Step 1: Replace deps.py with the wired version**

```python
# addon/app/deps.py
"""FastAPI dependencies — singletons created once per process."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from .adapters.db import DB
from .adapters.fs_adapter import FsAdapter
from .adapters.ha_client import HAClient


def get_supervisor_token() -> str:
    token = os.environ.get("SUPERVISOR_TOKEN")
    if not token:
        raise RuntimeError("SUPERVISOR_TOKEN not set — Add-on must run under HA Supervisor")
    return token


def get_ha_ws_url() -> str:
    # Inside Supervisor, this resolves to the core WebSocket endpoint.
    return os.environ.get("HA_WS_URL", "ws://supervisor/core/websocket")


def get_ha_rest_url() -> str:
    return os.environ.get("HA_REST_URL", "http://supervisor/core")


@lru_cache(maxsize=1)
def get_knx_root() -> Path:
    return Path(os.environ.get("KNX_ROOT", "/config/knx"))


@lru_cache(maxsize=1)
def get_data_dir() -> Path:
    return Path(os.environ.get("DATA_DIR", "/data"))


@lru_cache(maxsize=1)
def get_fs_adapter() -> FsAdapter:
    return FsAdapter(root=get_knx_root())


@lru_cache(maxsize=1)
def get_db() -> DB:
    return DB(path=get_data_dir() / "migration_history.db")


# HAClient is created in main.py lifespan to bind its lifecycle to the app.
_ha_client_holder: dict[str, HAClient] = {}


def set_ha_client(client: HAClient) -> None:
    _ha_client_holder["client"] = client


def get_ha_client() -> HAClient:
    if "client" not in _ha_client_holder:
        raise RuntimeError("HAClient not initialised")
    return _ha_client_holder["client"]
```

- [ ] **Step 2: Run mypy on deps**

Run: `cd addon/app && uv run mypy --strict app/deps.py`
Expected: `Success: no issues found`

- [ ] **Step 3: Commit**

```bash
git add addon/app/deps.py
git commit -m "refactor(deps): wire FsAdapter, DB, and HAClient singletons"
```

---

## Task 11: yaml_io router

**Files:**
- Create: `addon/app/routers/yaml_io.py`
- Create: `addon/app/tests/test_routers_yaml_io.py`

- [ ] **Step 1: Write the failing test**

```python
# addon/app/tests/test_routers_yaml_io.py
"""yaml_io router — list and parse YAML files under /config/knx."""
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import build_app
from app.adapters.fs_adapter import FsAdapter
from app import deps


@pytest.fixture
async def client(tmp_knx_dir: Path, monkeypatch: pytest.MonkeyPatch) -> AsyncClient:
    deps.get_fs_adapter.cache_clear()
    monkeypatch.setattr(deps, "get_knx_root", lambda: tmp_knx_dir)
    app = build_app(start_ha_client=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_list_yaml_files(client: AsyncClient) -> None:
    resp = await client.get("/api/yaml/files")
    assert resp.status_code == 200
    body = resp.json()
    names = sorted(f["name"] for f in body["files"])
    assert names == ["light.yaml", "switch.yaml"]


@pytest.mark.asyncio
async def test_parse_yaml_returns_domain_summary(client: AsyncClient) -> None:
    resp = await client.get("/api/yaml/parse", params={"path": "light.yaml"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["path"] == "light.yaml"
    assert len(body["domains"]) == 1
    assert body["domains"][0]["domain"] == "light"
    assert body["domains"][0]["entity_names"] == ["Diele"]


@pytest.mark.asyncio
async def test_parse_missing_file_returns_404(client: AsyncClient) -> None:
    resp = await client.get("/api/yaml/parse", params={"path": "nope.yaml"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_parse_rejects_path_traversal(client: AsyncClient) -> None:
    resp = await client.get("/api/yaml/parse", params={"path": "../etc/passwd"})
    assert resp.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd addon/app && uv run pytest tests/test_routers_yaml_io.py -v`
Expected: FAIL — `build_app` not exported / yaml_io not implemented

- [ ] **Step 3: Implement yaml_io router**

```python
# addon/app/routers/yaml_io.py
"""Endpoints to list and parse YAML files in /config/knx/."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from knx_yaml_to_ui_core.parser import ParseError, parse_yaml

from ..adapters.fs_adapter import FsAdapter, FsError
from ..deps import get_fs_adapter
from ..schemas import ParsedDomainSummary, YamlFile, YamlFilesResponse, YamlParseResponse

router = APIRouter(prefix="/api/yaml", tags=["yaml"])


@router.get("/files", response_model=YamlFilesResponse)
async def list_files(fs: FsAdapter = Depends(get_fs_adapter)) -> YamlFilesResponse:
    names = await fs.list_files()
    items = []
    for name in names:
        content = await fs.read(name)
        items.append(YamlFile(name=name, size_bytes=len(content)))
    return YamlFilesResponse(files=items)


@router.get("/parse", response_model=YamlParseResponse)
async def parse_file(
    path: str = Query(..., description="YAML file relative to /config/knx/"),
    fs: FsAdapter = Depends(get_fs_adapter),
) -> YamlParseResponse:
    try:
        content = await fs.read(path)
    except FsError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"{path} not found") from exc

    try:
        parsed = parse_yaml(content)
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    domains = [
        ParsedDomainSummary(
            domain=domain,
            entity_count=len(entries),
            entity_names=[e.get("name", "<unnamed>") for e in entries],
        )
        for domain, entries in parsed.items()
    ]
    return YamlParseResponse(path=path, domains=domains, raw_size=len(content))
```

- [ ] **Step 4: Add a build_app helper to main.py**

Replace `addon/app/main.py`:

```python
# addon/app/main.py
"""FastAPI entry point. `build_app(start_ha_client=...)` lets tests skip the WS lifecycle."""
from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI

from .adapters.ha_client import HAClient
from .deps import (
    get_data_dir,
    get_db,
    get_ha_ws_url,
    get_supervisor_token,
    set_ha_client,
)
from .logging_config import configure_logging
from .routers import health, yaml_io


def build_app(*, start_ha_client: bool = True) -> FastAPI:
    configure_logging()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        db = get_db()
        await db.init()
        if start_ha_client:
            client = HAClient(url=get_ha_ws_url(), token=get_supervisor_token())
            await client.connect()
            set_ha_client(client)
            try:
                yield
            finally:
                await client.close()
        else:
            yield

    app = FastAPI(
        title="knx-yaml-to-ui",
        version="0.0.2",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.include_router(health.router, prefix="/api")
    app.include_router(yaml_io.router)

    @app.get("/api")
    async def root() -> dict[str, str]:
        return {"status": "ok", "service": "knx-yaml-to-ui"}

    return app


app = build_app()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd addon/app && uv run pytest tests/test_routers_yaml_io.py -v --cov=app.routers.yaml_io`
Expected: 4 passed, coverage ≥85%

- [ ] **Step 6: Commit**

```bash
git add addon/app/routers/yaml_io.py addon/app/main.py addon/app/tests/test_routers_yaml_io.py
git commit -m "feat(router): add /api/yaml/files and /api/yaml/parse"
```

---

## Task 12: convert router (dry-run + commit)

**Files:**
- Create: `addon/app/routers/convert.py`
- Create: `addon/app/tests/test_routers_convert.py`

- [ ] **Step 1: Extend conftest with a FakeHAClient**

Edit `addon/app/tests/conftest.py` — append:

```python
from typing import Any


class FakeHAClient:
    """In-memory stand-in for HAClient. Records calls; canned results."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.results: dict[str, dict[str, Any]] = {}
        self.errors: dict[str, str] = {}
        self.next_entity_id = "light.diele"

    async def send(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.sent.append(payload)
        ptype = payload["type"]
        if ptype in self.errors:
            from app.adapters.ha_client import HAClientError

            raise HAClientError(self.errors[ptype])
        if ptype in self.results:
            return self.results[ptype]
        if ptype == "knx/validate_entity":
            return {"success": True}
        if ptype == "knx/create_entity":
            return {"entity_id": self.next_entity_id, "unique_id": "abc123"}
        if ptype == "config/entity_registry/list":
            return {"entities": []}
        return {}


@pytest.fixture
def fake_ha_client() -> FakeHAClient:
    return FakeHAClient()
```

- [ ] **Step 2: Write the failing convert test**

```python
# addon/app/tests/test_routers_convert.py
"""convert router — dry-run + commit for the light domain."""
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app import deps
from app.main import build_app

from .conftest import FakeHAClient


@pytest.fixture
async def client(
    tmp_knx_dir: Path,
    tmp_path: Path,
    fake_ha_client: FakeHAClient,
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncClient:
    deps.get_fs_adapter.cache_clear()
    deps.get_db.cache_clear()
    monkeypatch.setattr(deps, "get_knx_root", lambda: tmp_knx_dir)
    monkeypatch.setattr(deps, "get_data_dir", lambda: tmp_path)
    deps.set_ha_client(fake_ha_client)  # type: ignore[arg-type]
    app = build_app(start_ha_client=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await deps.get_db().init()
        yield c


@pytest.mark.asyncio
async def test_dry_run_returns_one_entry_for_light(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/convert/dry-run", json={"path": "light.yaml", "domain": "light"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["domain"] == "light"
    assert len(body["entries"]) == 1
    entry = body["entries"][0]
    assert entry["name"] == "Diele"
    assert entry["validation"] == "ok"
    assert entry["payload"]["platform"] == "light"


@pytest.mark.asyncio
async def test_commit_sends_create_entity_to_ha(
    client: AsyncClient, fake_ha_client: FakeHAClient
) -> None:
    resp = await client.post(
        "/api/convert/commit", json={"path": "light.yaml", "domain": "light"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["entries"][0]["entity_id"] == "light.diele"
    assert body["entries"][0]["applied"] is True
    types_sent = [m["type"] for m in fake_ha_client.sent]
    assert "knx/validate_entity" in types_sent
    assert "knx/create_entity" in types_sent


@pytest.mark.asyncio
async def test_commit_records_migration_row(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/convert/commit", json={"path": "light.yaml", "domain": "light"}
    )
    body = resp.json()
    rows = await deps.get_db().list_rows(limit=10)
    assert any(r["id"] == body["migration_id"] for r in rows)


@pytest.mark.asyncio
async def test_commit_continues_on_per_entity_error(
    client: AsyncClient, fake_ha_client: FakeHAClient
) -> None:
    fake_ha_client.errors["knx/create_entity"] = "boom from HA"
    resp = await client.post(
        "/api/convert/commit", json={"path": "light.yaml", "domain": "light"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["entries"][0]["applied"] is False
    assert "boom" in body["entries"][0]["error"]


@pytest.mark.asyncio
async def test_dry_run_unsupported_domain_returns_400(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/convert/dry-run", json={"path": "light.yaml", "domain": "climate"}
    )
    assert resp.status_code == 400
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd addon/app && uv run pytest tests/test_routers_convert.py -v`
Expected: FAIL — convert router missing

- [ ] **Step 4: Implement convert router**

```python
# addon/app/routers/convert.py
"""Convert router — dry-run + commit for one supported domain at a time."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from knx_yaml_to_ui_core.builders import BUILDERS
from knx_yaml_to_ui_core.parser import ParseError, parse_yaml
from knx_yaml_to_ui_core.validators import UnsupportedFeature, ValidationError

from ..adapters.db import DB
from ..adapters.fs_adapter import FsAdapter, FsError
from ..adapters.ha_client import HAClient, HAClientError
from ..deps import get_db, get_fs_adapter, get_ha_client
from ..schemas import (
    CommitRequest,
    CommitResponse,
    CommitResultEntry,
    DryRunEntry,
    DryRunRequest,
    DryRunResponse,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/convert", tags=["convert"])

SUPPORTED_DOMAINS = set(BUILDERS.keys())  # Slice 1A: {"light"}


def _ensure_supported(domain: str) -> None:
    if domain not in SUPPORTED_DOMAINS:
        raise HTTPException(
            status_code=400,
            detail=f"domain '{domain}' not supported in Slice 1A (supported: {sorted(SUPPORTED_DOMAINS)})",
        )


async def _load_and_parse(path: str, fs: FsAdapter) -> dict[str, list[dict]]:
    try:
        content = await fs.read(path)
    except FsError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"{path} not found") from exc
    try:
        return parse_yaml(content)
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/dry-run", response_model=DryRunResponse)
async def dry_run(
    req: DryRunRequest,
    fs: FsAdapter = Depends(get_fs_adapter),
) -> DryRunResponse:
    _ensure_supported(req.domain)
    parsed = await _load_and_parse(req.path, fs)
    entries: list[DryRunEntry] = []
    builder = BUILDERS[req.domain]
    for yml in parsed.get(req.domain, []):
        try:
            payload = builder(yml)
            entries.append(
                DryRunEntry(name=yml.get("name", "<unnamed>"), payload=payload, validation="ok")
            )
        except (ValidationError, UnsupportedFeature) as exc:
            entries.append(
                DryRunEntry(
                    name=yml.get("name", "<unnamed>"),
                    payload={},
                    validation="error",
                    message=str(exc),
                )
            )
    return DryRunResponse(path=req.path, domain=req.domain, entries=entries)


@router.post("/commit", response_model=CommitResponse)
async def commit(
    req: CommitRequest,
    fs: FsAdapter = Depends(get_fs_adapter),
    ha: HAClient = Depends(get_ha_client),
    db: DB = Depends(get_db),
) -> CommitResponse:
    _ensure_supported(req.domain)
    parsed = await _load_and_parse(req.path, fs)
    builder = BUILDERS[req.domain]
    entries: list[CommitResultEntry] = []

    for yml in parsed.get(req.domain, []):
        name = yml.get("name", "<unnamed>")
        if req.only_names is not None and name not in req.only_names:
            continue
        try:
            payload = builder(yml)
        except (ValidationError, UnsupportedFeature) as exc:
            entries.append(CommitResultEntry(name=name, applied=False, error=str(exc)))
            continue
        try:
            await ha.send({"type": "knx/validate_entity", **payload})
            create_result = await ha.send({"type": "knx/create_entity", **payload})
            entries.append(
                CommitResultEntry(
                    name=name,
                    entity_id=create_result.get("entity_id"),
                    applied=True,
                )
            )
        except HAClientError as exc:
            log.exception("commit failed for %s", name)
            entries.append(CommitResultEntry(name=name, applied=False, error=str(exc)))

    migration_id = await db.insert_row(
        kind="convert.commit",
        payload={
            "path": req.path,
            "domain": req.domain,
            "entries": [e.model_dump() for e in entries],
        },
        status="ok" if all(e.applied for e in entries) else "partial",
    )
    return CommitResponse(
        path=req.path,
        domain=req.domain,
        migration_id=migration_id,
        entries=entries,
    )
```

- [ ] **Step 5: Register router in main.py**

Edit `addon/app/main.py` — add to the `build_app` body:

```python
    from .routers import convert  # noqa: PLC0415
    app.include_router(convert.router)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd addon/app && uv run pytest tests/test_routers_convert.py -v --cov=app.routers.convert`
Expected: 5 passed, coverage ≥80%

- [ ] **Step 7: Commit**

```bash
git add addon/app/routers/convert.py addon/app/tests/test_routers_convert.py addon/app/main.py addon/app/tests/conftest.py
git commit -m "feat(router): add /api/convert/dry-run and /api/convert/commit for light domain"
```

---

## Task 13: entities router

**Files:**
- Create: `addon/app/routers/entities.py`
- Create: `addon/app/tests/test_routers_entities.py`

- [ ] **Step 1: Write the failing test**

```python
# addon/app/tests/test_routers_entities.py
"""entities router — list + read KNX entities via HAClient."""
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app import deps
from app.main import build_app

from .conftest import FakeHAClient


@pytest.fixture
async def client(
    tmp_knx_dir: Path,
    tmp_path: Path,
    fake_ha_client: FakeHAClient,
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncClient:
    deps.get_fs_adapter.cache_clear()
    deps.get_db.cache_clear()
    monkeypatch.setattr(deps, "get_knx_root", lambda: tmp_knx_dir)
    monkeypatch.setattr(deps, "get_data_dir", lambda: tmp_path)
    deps.set_ha_client(fake_ha_client)  # type: ignore[arg-type]
    fake_ha_client.results["config/entity_registry/list"] = {
        "entities": [
            {"entity_id": "light.diele", "platform": "knx", "name": "Diele"},
            {"entity_id": "switch.steckdose", "platform": "knx", "name": "Steckdose"},
            {"entity_id": "light.fremd", "platform": "hue", "name": "Hue"},
        ]
    }
    fake_ha_client.results["knx/get_entity_config"] = {
        "platform": "light",
        "data": {"entity": {"name": "Diele"}, "knx": {"ga_switch": {"write": "1/0/15"}}},
    }
    app = build_app(start_ha_client=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_list_entities_filters_to_knx_platform(client: AsyncClient) -> None:
    resp = await client.get("/api/entities")
    assert resp.status_code == 200
    body = resp.json()
    ids = sorted(e["entity_id"] for e in body["entities"])
    assert ids == ["light.diele", "switch.steckdose"]


@pytest.mark.asyncio
async def test_get_one_entity_returns_config(client: AsyncClient) -> None:
    resp = await client.get("/api/entities/light.diele")
    assert resp.status_code == 200
    body = resp.json()
    assert body["entity_id"] == "light.diele"
    assert body["config"]["platform"] == "light"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd addon/app && uv run pytest tests/test_routers_entities.py -v`
Expected: FAIL — entities router missing

- [ ] **Step 3: Implement entities router**

```python
# addon/app/routers/entities.py
"""Entities router — list KNX entities + read one config."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..adapters.ha_client import HAClient
from ..deps import get_ha_client
from ..schemas import EntitiesResponse, EntityConfigResponse, EntitySummary

router = APIRouter(prefix="/api/entities", tags=["entities"])


@router.get("", response_model=EntitiesResponse)
async def list_entities(ha: HAClient = Depends(get_ha_client)) -> EntitiesResponse:
    result = await ha.send({"type": "config/entity_registry/list"})
    entries = [
        EntitySummary(
            entity_id=e["entity_id"],
            name=e.get("name"),
            platform=e.get("platform", ""),
            state=None,
        )
        for e in result.get("entities", [])
        if e.get("platform") == "knx"
    ]
    return EntitiesResponse(entities=entries)


@router.get("/{entity_id}", response_model=EntityConfigResponse)
async def get_entity(entity_id: str, ha: HAClient = Depends(get_ha_client)) -> EntityConfigResponse:
    config = await ha.send({"type": "knx/get_entity_config", "entity_id": entity_id})
    return EntityConfigResponse(entity_id=entity_id, config=config)
```

- [ ] **Step 4: Register router in main.py**

Append to `build_app` body:

```python
    from .routers import entities  # noqa: PLC0415
    app.include_router(entities.router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd addon/app && uv run pytest tests/test_routers_entities.py -v --cov=app.routers.entities`
Expected: 2 passed, coverage ≥85%

- [ ] **Step 6: Commit**

```bash
git add addon/app/routers/entities.py addon/app/tests/test_routers_entities.py addon/app/main.py
git commit -m "feat(router): add /api/entities list + read endpoints"
```

---

## Task 14: ws router (state-stream)

**Files:**
- Create: `addon/app/routers/ws.py`
- Create: `addon/app/tests/test_routers_ws.py`

- [ ] **Step 1: Write the failing test**

```python
# addon/app/tests/test_routers_ws.py
"""ws router — forwards HA state_changed events filtered to KNX entities."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import deps
from app.main import build_app

from .conftest import FakeHAClient


class StreamingFakeHAClient(FakeHAClient):
    def __init__(self) -> None:
        super().__init__()
        self._queue: asyncio.Queue[dict] = asyncio.Queue()

    async def subscribe(self, payload):
        async def iterator():
            while True:
                yield await self._queue.get()

        return 1, iterator()

    async def push_event(self, event: dict) -> None:
        await self._queue.put(event)


@pytest.fixture
def streaming_client(
    tmp_knx_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    deps.get_fs_adapter.cache_clear()
    deps.get_db.cache_clear()
    monkeypatch.setattr(deps, "get_knx_root", lambda: tmp_knx_dir)
    monkeypatch.setattr(deps, "get_data_dir", lambda: tmp_path)
    fake = StreamingFakeHAClient()
    deps.set_ha_client(fake)  # type: ignore[arg-type]
    app = build_app(start_ha_client=False)
    with TestClient(app) as client:
        yield client, fake


def test_ws_stream_forwards_knx_state_changes(streaming_client) -> None:
    client, fake = streaming_client

    async def producer() -> None:
        await asyncio.sleep(0.05)
        await fake.push_event(
            {
                "event_type": "state_changed",
                "data": {
                    "entity_id": "light.diele",
                    "new_state": {"state": "on", "attributes": {"brightness": 255}},
                },
            }
        )

    with client.websocket_connect("/ws/state-stream") as ws:
        asyncio.get_event_loop().run_until_complete(producer())
        msg = json.loads(ws.receive_text())
        assert msg["entity_id"] == "light.diele"
        assert msg["state"] == "on"


def test_ws_stream_filters_non_knx_entities(streaming_client) -> None:
    client, fake = streaming_client

    async def producer() -> None:
        await asyncio.sleep(0.05)
        await fake.push_event(
            {
                "event_type": "state_changed",
                "data": {
                    "entity_id": "sensor.weather",
                    "new_state": {"state": "sunny"},
                },
            }
        )
        await fake.push_event(
            {
                "event_type": "state_changed",
                "data": {
                    "entity_id": "light.diele",
                    "new_state": {"state": "off"},
                },
            }
        )

    with client.websocket_connect("/ws/state-stream") as ws:
        asyncio.get_event_loop().run_until_complete(producer())
        msg = json.loads(ws.receive_text())
        # First (non-KNX) event must be filtered out; first delivered must be light.diele
        assert msg["entity_id"] == "light.diele"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd addon/app && uv run pytest tests/test_routers_ws.py -v`
Expected: FAIL — ws router missing

- [ ] **Step 3: Implement ws router**

```python
# addon/app/routers/ws.py
"""Browser-facing WebSocket — proxies filtered HA state_changed events."""
from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..deps import get_ha_client

log = logging.getLogger(__name__)
router = APIRouter()

_KNX_PLATFORMS = {
    "light",
    "switch",
    "cover",
    "binary_sensor",
    "sensor",
    "climate",
    "time",
    "datetime",
}


def _is_knx_state_event(event: dict) -> bool:
    if event.get("event_type") != "state_changed":
        return False
    entity_id = event.get("data", {}).get("entity_id", "")
    return entity_id.split(".", 1)[0] in _KNX_PLATFORMS


@router.websocket("/ws/state-stream")
async def state_stream(ws: WebSocket) -> None:
    await ws.accept()
    ha = get_ha_client()
    try:
        _, events = await ha.subscribe(
            {"type": "subscribe_events", "event_type": "state_changed"}
        )
        async for event in events:
            if not _is_knx_state_event(event):
                continue
            data = event["data"]
            new_state = data.get("new_state") or {}
            await ws.send_json(
                {
                    "entity_id": data.get("entity_id"),
                    "state": new_state.get("state"),
                    "attributes": new_state.get("attributes", {}),
                }
            )
    except WebSocketDisconnect:
        log.info("ws/state-stream client disconnected")
    except Exception as exc:
        log.exception("ws/state-stream crashed: %s", exc)
        await ws.close(code=1011)
```

- [ ] **Step 4: Register router in main.py**

Append to `build_app` body:

```python
    from .routers import ws  # noqa: PLC0415
    app.include_router(ws.router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd addon/app && uv run pytest tests/test_routers_ws.py -v --cov=app.routers.ws`
Expected: 2 passed, coverage ≥75%

- [ ] **Step 6: Commit**

```bash
git add addon/app/routers/ws.py addon/app/tests/test_routers_ws.py addon/app/main.py
git commit -m "feat(router): add /ws/state-stream forwarding filtered KNX state_changed events"
```

---

## Task 15: CI — backend-integration job

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add backend-integration job**

Append (or insert next to the existing backend-unit job) in `.github/workflows/ci.yml`:

```yaml
  backend-integration:
    name: Backend integration tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install uv
        uses: astral-sh/setup-uv@v3
      - name: Set up Python
        run: uv python install 3.12
      - name: Sync shared core
        working-directory: shared
        run: uv sync --extra dev
      - name: Sync addon app
        working-directory: addon/app
        run: uv sync --extra dev
      - name: Run addon tests with coverage
        working-directory: addon/app
        run: |
          uv run pytest tests/ \
            --cov=app \
            --cov-report=term-missing \
            --cov-fail-under=70 \
            -v
```

- [ ] **Step 2: Verify locally before pushing**

Run: `cd addon/app && uv run pytest tests/ --cov=app --cov-fail-under=70 -v`
Expected: all tests pass, coverage ≥70%

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add backend-integration job with coverage gate"
```

---

## Task 16: Manual smoke test on Skynet HA

**Files:** none (operator script only)

- [ ] **Step 1: Build the Add-on image**

Run from `addon/`:

```bash
docker buildx build --platform linux/amd64 -t local/knx-yaml-to-ui:dev --load .
```

Expected: build succeeds.

- [ ] **Step 2: Copy Add-on to Skynet HA local add-ons folder**

Same procedure as Plan-01 Task 13 (Local-Add-on install): push the `addon/` tree into the HA-local-add-ons share, reload Add-on store, install.

- [ ] **Step 3: Provision a fixture YAML in /config/knx/**

On the HA host, place `/config/knx/light_test.yaml`:

```yaml
light:
  - name: Plan02 Smoke Diele
    address: 1/0/200
    state_address: 1/5/200
```

- [ ] **Step 4: Curl the endpoints from inside Skynet's terminal Add-on**

```bash
INGRESS=http://localhost:8123/api/hassio_ingress/<token>  # taken from Add-on UI

curl -s $INGRESS/api/health | jq
curl -s $INGRESS/api/yaml/files | jq
curl -s "$INGRESS/api/yaml/parse?path=light_test.yaml" | jq
curl -s -X POST $INGRESS/api/convert/dry-run \
  -H "Content-Type: application/json" \
  -d '{"path": "light_test.yaml", "domain": "light"}' | jq
curl -s -X POST $INGRESS/api/convert/commit \
  -H "Content-Type: application/json" \
  -d '{"path": "light_test.yaml", "domain": "light"}' | jq
curl -s $INGRESS/api/entities | jq
```

Expected: each call returns 200 with the documented shape. Commit response contains `entity_id: light.plan02_smoke_diele`.

- [ ] **Step 5: Verify the entity in HA**

Open HA → Settings → Devices & Services → Entities → search "Plan02". Entity must exist with platform `knx`.

- [ ] **Step 6: WS smoke**

From a workstation with `wscat`:

```bash
wscat -c "ws://<ha-host>:8123/api/hassio_ingress/<token>/ws/state-stream"
# In HA UI, toggle light.plan02_smoke_diele.
# Expected event:  {"entity_id":"light.plan02_smoke_diele","state":"on", ...}
```

- [ ] **Step 7: Record smoke test result**

Create `docs/active/webapp/2026-05-21-plan-02-smoke.md` with a 5-line summary: which curls were green, screenshots if helpful, HA-version tested against.

- [ ] **Step 8: Commit smoke record**

```bash
git add docs/active/webapp/2026-05-21-plan-02-smoke.md
git commit -m "docs(webapp): record plan-02 manual smoke test against Skynet HA"
```

---

## Task 17: Tag Plan-02 completion

**Files:** none (git tag only)

- [ ] **Step 1: Run full test-suite one more time**

```bash
cd shared && uv run pytest -q
cd addon/app && uv run pytest -q
```

Expected: all green.

- [ ] **Step 2: Tag**

```bash
cd C:/Users/user/tools/knx-yaml-to-ui
git tag -a v0.0.2-backend-mvp -m "Plan 02 complete: backend MVP for light domain — dry-run, commit, entity list, state-stream"
```

- [ ] **Step 3: Push tag (when ready)**

```bash
git push origin main --tags  # only after Plan-03 starts or when explicitly requested
```

---

## Self-Review Notes

**Spec coverage check:**
- Spec §4.1 backend layout → Tasks 5-14 cover all listed files for Slice 1A (parser, light builder, validators, fs_adapter, ha_client, db, yaml_io, convert, entities, ws). `core/reverser.py`, `conflict.py`, additional builders, and `license/` are correctly deferred to later plans.
- Spec §5.1 data-flow → Tasks 11-12 implement steps 1-2 (file list/parse) and 4-6 (dry-run / commit via WS). Step 7 (browser update) lands in Plan-03.
- Spec §5.5 live-stream → Task 14.
- Spec §6 error handling → ValidationError/UnsupportedFeature surface as 422; FsError as 400; HAClientError caught per-entity in commit (matches "Commit-Mid-Failure" pattern).
- Spec §7.1 testing pyramid → Tasks 1-14 each ship pytest tests; integration coverage via FakeHAClient.
- Spec §7.2 coverage gates → CI gate set to ≥70% on addon/app; core hits ≥85% via Task 4.
- Bugfix #3 → already shipped in Plan-01 (slugify).
- Bugfix #4 → Task 4.
- Bugfix #11 → Task 8.

**Out of scope for Plan-02 (correctly deferred):**
- Domains 2-9, full Bugfix set #5-#10/#12/#13 → Slice 2 (Plan-04 or later).
- Conflict-Checker, History UI, Rollback → Slices 3-5.
- Frontend SPA → Plan-03.
- License worker → Phase 6+.

**Placeholder scan:** none — every code step has full code; every command has an expected outcome.

**Type consistency check:**
- `UIEntityPayload` shape (Task 1) is consumed verbatim by `build_light` (Task 4), `DryRunEntry.payload` (Task 9 / Task 12), and unpacked into `knx/create_entity` (Task 12 — `await ha.send({"type": "knx/create_entity", **payload})`).
- `HAClient.send(payload) -> dict[str, Any]` (Task 6) is called by `convert.py` (Task 12) and `entities.py` (Task 13) with the same signature; `subscribe(payload) -> (int, AsyncIterator)` (Task 6) is consumed by `ws.py` (Task 14) and `StreamingFakeHAClient` (Task 14).
- `DB.insert_row(kind=, payload=, status=) -> int` (Task 7) matches the call site in `convert.commit` (Task 12).
- `FsAdapter.read(name) -> bytes` and `.list_files() -> list[str]` and `.write_atomic(name, content)` (Task 5) match usage in `yaml_io` (Task 11), `convert` (Task 12).
- `build_app(start_ha_client: bool = True)` (Task 11) matches all fixture call sites in Tasks 11-14.

---

## Execution Handoff

Plan complete and saved to `docs/active/webapp/2026-05-21-plan-02-backend-mvp.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Uses `superpowers:subagent-driven-development`.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.
