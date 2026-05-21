# Plan 01: Foundation — Repo Restructure + Add-on Scaffold + WS-API Spike

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure existing CLI into monorepo with extractable core-library; scaffold HA Add-on Docker image with Ingress; run WS-API-Discovery-Spike to catalog HA-KNX-WS-Commands. Output of this plan is the foundation for Slice 1 (MVP).

**Architecture:** Single git repo at `C:/Users/user/tools/knx-yaml-to-ui/`. Subfolders: `cli/`, `addon/`, `frontend/`, `shared/`, `docs/`. Core-lib in `shared/knx_yaml_to_ui_core/` imported by both CLI and Add-on. Add-on uses `ghcr.io/home-assistant/<arch>-base-python:3.12-alpine3.20`, s6-overlay services, FastAPI+uvicorn with Ingress.

**Tech Stack:** Python 3.12, uv (package manager), pytest, ruff, mypy, FastAPI, uvicorn, Docker, GitHub Actions, HA Add-on framework.

**Spec Reference:** `docs/active/webapp/2026-05-21-design.md` Sections 4.0, 8 (Phase 0a/0b + WS-API-Discovery-Spike).

---

## File Structure (created in this plan)

```
knx-yaml-to-ui/
├── .git/                                # NEW — git init
├── .gitignore                           # NEW
├── .github/workflows/ci.yml             # NEW — baseline CI
├── README.md                            # MODIFIED — repo overview
├── cli/
│   ├── knx_yaml_to_ui.py                # MOVED from root
│   └── README.md                        # MOVED from root
├── shared/
│   ├── pyproject.toml                   # NEW
│   └── knx_yaml_to_ui_core/
│       ├── __init__.py                  # NEW
│       ├── ulid.py                      # EXTRACTED from CLI
│       ├── slugify.py                   # EXTRACTED + Bugfix #3 fix
│       └── tests/
│           ├── __init__.py              # NEW
│           ├── test_ulid.py             # NEW
│           └── test_slugify.py          # NEW — Bugfix #3 fixture
├── addon/
│   ├── config.yaml                      # NEW — Add-on manifest
│   ├── Dockerfile                       # NEW
│   ├── README.md                        # NEW
│   ├── icon.png                         # NEW — placeholder
│   ├── logo.png                         # NEW — placeholder
│   ├── rootfs/
│   │   └── etc/services.d/uvicorn/
│   │       ├── run                      # NEW — s6 service
│   │       └── finish                   # NEW
│   └── app/
│       ├── pyproject.toml               # NEW
│       ├── main.py                      # NEW — FastAPI minimal
│       ├── deps.py                      # NEW — supervisor-token + WS-client stub
│       └── routers/
│           ├── __init__.py              # NEW
│           └── health.py                # NEW — /api/health, /api/version
└── docs/active/webapp/
    ├── 2026-05-21-design.md             # EXISTS
    ├── 2026-05-21-plan-01-foundation.md # THIS FILE
    └── ws-api-catalog.md                # NEW — output of WS-API-Spike
```

---

## Task 1: Initialize git repo

**Files:**
- Create: `.git/` (via `git init`)
- Create: `.gitignore`

- [ ] **Step 1: Verify no existing .git**

Run: `test -d C:/Users/user/tools/knx-yaml-to-ui/.git && echo EXISTS || echo OK`
Expected: `OK`

- [ ] **Step 2: Init repo**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git init -b main
```
Expected: `Initialized empty Git repository...`

- [ ] **Step 3: Write .gitignore**

Create `C:/Users/user/tools/knx-yaml-to-ui/.gitignore`:
```
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
.pytest_cache/
.ruff_cache/
.mypy_cache/
htmlcov/
.coverage

# Node
node_modules/
dist/
.svelte-kit/
build/

# Docker
.docker-build/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Add-on local-test
addon-data/
```

- [ ] **Step 4: First commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add .gitignore && git commit -m "chore: init repo with gitignore"
```
Expected: `[main (root-commit) ...] chore: init repo with gitignore`

---

## Task 2: Create monorepo directories

**Files:**
- Create: `cli/`, `addon/`, `frontend/`, `shared/`, `docs/active/webapp/` (already exists)

- [ ] **Step 1: Create top-level directories**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && mkdir -p cli addon/app addon/rootfs/etc/services.d/uvicorn frontend shared/knx_yaml_to_ui_core/tests
```
Expected: silent success.

- [ ] **Step 2: Verify structure**

Run: `find C:/Users/user/tools/knx-yaml-to-ui -maxdepth 3 -type d | sort`
Expected output includes:
```
.../addon
.../addon/app
.../addon/rootfs
.../cli
.../docs
.../frontend
.../shared
.../shared/knx_yaml_to_ui_core
.../shared/knx_yaml_to_ui_core/tests
```

---

## Task 3: Move existing CLI files into cli/

**Files:**
- Modify: move `knx_yaml_to_ui.py` → `cli/knx_yaml_to_ui.py`
- Modify: move `README.md` → `cli/README.md`

- [ ] **Step 1: git-mv the files**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git mv knx_yaml_to_ui.py cli/knx_yaml_to_ui.py
```
Expected: silent. The file is at `cli/` now.

Then:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git mv README.md cli/README.md
```

(`git mv` only works if files are tracked. They aren't yet since we just created the repo. Use regular `mv` + `git add`.)

- [ ] **Step 1b: Use mv if git-mv fails**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && mv knx_yaml_to_ui.py cli/ && mv README.md cli/
```
Expected: silent.

- [ ] **Step 2: Stage + commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add cli/ && git commit -m "chore: move CLI into cli/ subfolder for monorepo layout"
```
Expected: `[main ...] chore: move CLI into cli/ subfolder for monorepo layout`

---

## Task 4: Create root README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write root README**

Create `C:/Users/user/tools/knx-yaml-to-ui/README.md`:
```markdown
# knx-yaml-to-ui

Tooling for converting Home Assistant KNX YAML configs to UI-managed entities.

## Components

- **`cli/`** — original Python CLI (works on HA Core / venv installs)
- **`addon/`** — HA Add-on (Docker image, Ingress UI) — under development
- **`frontend/`** — Svelte 5 SPA — under development
- **`shared/knx_yaml_to_ui_core/`** — pure-Python core library shared by CLI and Add-on
- **`docs/active/webapp/`** — design spec and implementation plans

## Status

Active development. See `docs/active/webapp/2026-05-21-design.md` for the design and `docs/active/webapp/2026-05-21-plan-01-foundation.md` for the current plan.

## License

MIT (will be added when first public release ships).
```

- [ ] **Step 2: Stage + commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add README.md && git commit -m "docs: add root README for monorepo"
```

---

## Task 5: Set up shared/ pyproject.toml + package skeleton

**Files:**
- Create: `shared/pyproject.toml`
- Create: `shared/knx_yaml_to_ui_core/__init__.py`
- Create: `shared/knx_yaml_to_ui_core/tests/__init__.py`

- [ ] **Step 1: Write pyproject.toml**

Create `C:/Users/user/tools/knx-yaml-to-ui/shared/pyproject.toml`:
```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "knx-yaml-to-ui-core"
version = "0.1.0"
description = "Core library for KNX YAML to UI-Config-Store conversion"
requires-python = ">=3.12"
dependencies = [
    "pyyaml>=6.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-cov>=4.1",
    "ruff>=0.6",
    "mypy>=1.11",
]

[tool.hatch.build.targets.wheel]
packages = ["knx_yaml_to_ui_core"]

[tool.pytest.ini_options]
testpaths = ["knx_yaml_to_ui_core/tests"]
python_files = "test_*.py"
addopts = "-v --cov=knx_yaml_to_ui_core --cov-report=term-missing"

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM"]

[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
```

- [ ] **Step 2: Write __init__.py files**

Create `C:/Users/user/tools/knx-yaml-to-ui/shared/knx_yaml_to_ui_core/__init__.py`:
```python
"""Core library for KNX YAML to UI-Config-Store conversion.

Pure Python, no I/O. Used by both CLI (cli/) and Add-on (addon/app/).
"""
__version__ = "0.1.0"
```

Create `C:/Users/user/tools/knx-yaml-to-ui/shared/knx_yaml_to_ui_core/tests/__init__.py` (empty file):
```python
```

- [ ] **Step 3: Install + verify**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui/shared && uv venv && uv pip install -e ".[dev]"
```
Expected: virtual env created, package installed in editable mode, no errors.

- [ ] **Step 4: Verify pytest discoverable**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui/shared && .venv/Scripts/python.exe -m pytest --collect-only
```
Expected: `no tests collected` (no tests yet — we're verifying pytest is wired correctly).

- [ ] **Step 5: Commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add shared/ && git commit -m "feat: scaffold shared/knx_yaml_to_ui_core package with pyproject"
```

---

## Task 6: Extract ulid.py into shared/ (TDD)

**Files:**
- Test: `shared/knx_yaml_to_ui_core/tests/test_ulid.py`
- Create: `shared/knx_yaml_to_ui_core/ulid.py`
- Reference: `cli/knx_yaml_to_ui.py` lines containing `gen_ulid` / `CROCKFORD`

- [ ] **Step 1: Read ulid logic from existing CLI**

Run:
```bash
grep -nA 20 "def gen_ulid" C:/Users/user/tools/knx-yaml-to-ui/cli/knx_yaml_to_ui.py
```
Expected: shows the existing function. Note line numbers.

- [ ] **Step 2: Write failing test**

Create `C:/Users/user/tools/knx-yaml-to-ui/shared/knx_yaml_to_ui_core/tests/test_ulid.py`:
```python
"""Tests for ULID generation — Crockford Base32, 26 chars, time-component-monotonic."""
import re
import time

from knx_yaml_to_ui_core.ulid import gen_ulid, CROCKFORD


def test_ulid_is_26_chars():
    ulid = gen_ulid()
    assert len(ulid) == 26, f"ULID must be 26 chars, got {len(ulid)}: {ulid!r}"


def test_ulid_uses_crockford_alphabet_only():
    ulid = gen_ulid()
    pattern = f"^[{CROCKFORD}]{{26}}$"
    assert re.match(pattern, ulid), f"ULID has chars outside Crockford: {ulid!r}"


def test_ulid_time_component_is_monotonic():
    """First 10 chars encode 48-bit ms-timestamp — must be non-decreasing across calls."""
    a = gen_ulid()
    time.sleep(0.002)
    b = gen_ulid()
    assert a[:10] <= b[:10], f"Time-component regressed: {a[:10]} → {b[:10]}"


def test_ulid_uniqueness_across_1000_calls():
    """Random-component (last 16 chars) collision probability is ~ 2^-80 per pair."""
    ulids = {gen_ulid() for _ in range(1000)}
    assert len(ulids) == 1000, "Collision detected in 1000-ULID sample"


def test_crockford_alphabet_constant():
    assert CROCKFORD == "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    assert len(CROCKFORD) == 32
```

- [ ] **Step 3: Run test to confirm it fails**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui/shared && .venv/Scripts/python.exe -m pytest knx_yaml_to_ui_core/tests/test_ulid.py -v
```
Expected: `ModuleNotFoundError: No module named 'knx_yaml_to_ui_core.ulid'`

- [ ] **Step 4: Implement ulid module**

Create `C:/Users/user/tools/knx-yaml-to-ui/shared/knx_yaml_to_ui_core/ulid.py`:
```python
"""ULID generation in Crockford Base32 — 48-bit time + 80-bit random, 26 chars total."""
import secrets
import time

CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def _encode_b32(value: int, length: int) -> str:
    chars: list[str] = []
    for _ in range(length):
        chars.append(CROCKFORD[value & 0x1F])
        value >>= 5
    return "".join(reversed(chars))


def gen_ulid() -> str:
    """Generate a 26-character Crockford-Base32 ULID.

    Format: 10 chars timestamp (ms since epoch) + 16 chars randomness.
    """
    time_ms = int(time.time() * 1000)
    rand_80 = secrets.randbits(80)
    return _encode_b32(time_ms, 10) + _encode_b32(rand_80, 16)
```

- [ ] **Step 5: Run test to confirm it passes**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui/shared && .venv/Scripts/python.exe -m pytest knx_yaml_to_ui_core/tests/test_ulid.py -v
```
Expected: `5 passed`.

- [ ] **Step 6: Commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add shared/knx_yaml_to_ui_core/ulid.py shared/knx_yaml_to_ui_core/tests/test_ulid.py && git commit -m "feat(core): extract ulid module from CLI with tests"
```

---

## Task 7: Extract slugify.py with Bugfix #3 (Umlauts)

**Files:**
- Test: `shared/knx_yaml_to_ui_core/tests/test_slugify.py`
- Create: `shared/knx_yaml_to_ui_core/slugify.py`

- [ ] **Step 1: Write failing test (Bugfix #3 cases)**

Create `C:/Users/user/tools/knx-yaml-to-ui/shared/knx_yaml_to_ui_core/tests/test_slugify.py`:
```python
"""Tests for slugify — entity_id-safe slugs with German umlaut transliteration (Bugfix #3)."""
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
def test_slugify_cases(name: str, expected: str):
    assert slugify(name) == expected


def test_slugify_idempotent():
    assert slugify(slugify("Heizung Küche")) == "heizung_kueche"


def test_slugify_only_ascii_output():
    """Output must be a-z0-9_ only — no umlauts, no spaces, no punctuation."""
    import re
    for inp in ["Küche & Bad", "Außen-Wand 1", "ÖÄÜß"]:
        out = slugify(inp)
        assert re.match(r"^[a-z0-9_]+$", out), f"Non-ascii chars in {out!r}"
```

- [ ] **Step 2: Run test to confirm it fails**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui/shared && .venv/Scripts/python.exe -m pytest knx_yaml_to_ui_core/tests/test_slugify.py -v
```
Expected: `ModuleNotFoundError: No module named 'knx_yaml_to_ui_core.slugify'`

- [ ] **Step 3: Implement slugify with Bugfix #3**

Create `C:/Users/user/tools/knx-yaml-to-ui/shared/knx_yaml_to_ui_core/slugify.py`:
```python
"""Entity-id-safe slug generation with German umlaut transliteration."""
import re

_UMLAUT_MAP = str.maketrans({
    "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
    "Ä": "Ae", "Ö": "Oe", "Ü": "Ue",
})


def slugify(name: str) -> str:
    """Convert a display name to a HA-entity_id-safe slug.

    German umlauts are transliterated (ä→ae etc.) before ASCII normalization,
    so 'Heizung Küche' → 'heizung_kueche', not 'heizung_k_che'.
    """
    s = name.translate(_UMLAUT_MAP).lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s
```

- [ ] **Step 4: Run test to confirm it passes**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui/shared && .venv/Scripts/python.exe -m pytest knx_yaml_to_ui_core/tests/test_slugify.py -v
```
Expected: `15 passed`.

- [ ] **Step 5: Verify coverage on slugify module**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui/shared && .venv/Scripts/python.exe -m pytest knx_yaml_to_ui_core/tests/test_slugify.py --cov=knx_yaml_to_ui_core.slugify --cov-report=term-missing
```
Expected: `100%` coverage of `slugify.py`.

- [ ] **Step 6: Commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add shared/knx_yaml_to_ui_core/slugify.py shared/knx_yaml_to_ui_core/tests/test_slugify.py && git commit -m "feat(core): extract slugify with German umlaut transliteration (Bugfix #3)"
```

---

## Task 8: Refactor CLI to import from shared/ (smoke-test)

**Files:**
- Modify: `cli/knx_yaml_to_ui.py` — replace local `slugify` + `gen_ulid` + `CROCKFORD` with imports from `knx_yaml_to_ui_core`

- [ ] **Step 1: Add cli/pyproject.toml referencing shared as path-dep**

Create `C:/Users/user/tools/knx-yaml-to-ui/cli/pyproject.toml`:
```toml
[project]
name = "knx-yaml-to-ui-cli"
version = "0.2.0"
description = "CLI wrapper around knx-yaml-to-ui-core"
requires-python = ">=3.12"
dependencies = [
    "knx-yaml-to-ui-core",
    "pyyaml>=6.0",
]

[tool.uv.sources]
knx-yaml-to-ui-core = { path = "../shared", editable = true }
```

- [ ] **Step 2: Locate the current local definitions in CLI**

Run:
```bash
grep -nE "^def slugify|^def gen_ulid|^CROCKFORD" C:/Users/user/tools/knx-yaml-to-ui/cli/knx_yaml_to_ui.py
```
Note the line numbers.

- [ ] **Step 3: Replace local definitions with import**

Edit `C:/Users/user/tools/knx-yaml-to-ui/cli/knx_yaml_to_ui.py`:

Find the `CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"` line and the block including `def gen_ulid()` and `def slugify(name: str) -> str:`. Replace all three with this import block at the top of the file (after the existing imports):

```python
from knx_yaml_to_ui_core.ulid import gen_ulid, CROCKFORD
from knx_yaml_to_ui_core.slugify import slugify
```

Delete the original `CROCKFORD = ...`, `def gen_ulid()`, and `def slugify(name)` definitions.

- [ ] **Step 4: Install CLI in dev mode + smoke-test it still runs**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui/cli && uv venv && uv pip install -e .
```
Expected: install OK, includes editable shared/.

Then smoke-test:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui/cli && .venv/Scripts/python.exe knx_yaml_to_ui.py --help
```
Expected: shows argparse help with subcommands `convert / restore / list-backups / apply-device-classes`.

- [ ] **Step 5: Commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add cli/ && git commit -m "refactor(cli): import ulid + slugify from shared core library"
```

---

## Task 9: Baseline CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write CI workflow**

Create `C:/Users/user/tools/knx-yaml-to-ui/.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  shared-core:
    name: shared/knx_yaml_to_ui_core
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: shared
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install uv
        run: pip install uv
      - name: Install package
        run: uv pip install --system -e ".[dev]"
      - name: Lint (ruff)
        run: ruff check knx_yaml_to_ui_core
      - name: Format check (ruff)
        run: ruff format --check knx_yaml_to_ui_core
      - name: Type check (mypy)
        run: mypy knx_yaml_to_ui_core
      - name: Test (pytest)
        run: pytest --cov=knx_yaml_to_ui_core --cov-report=xml --cov-fail-under=85
```

- [ ] **Step 2: Commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add .github/ && git commit -m "ci: add baseline workflow for shared/ core library"
```

---

## Task 10: Scaffold addon/config.yaml

**Files:**
- Create: `addon/config.yaml`

- [ ] **Step 1: Write Add-on manifest**

Create `C:/Users/user/tools/knx-yaml-to-ui/addon/config.yaml`:
```yaml
name: knx-yaml-to-ui
version: "0.0.1"
slug: knx_yaml_to_ui
description: Convert and manage HA-KNX YAML configs as UI entities
url: https://github.com/MauriceStockfleth/knx-yaml-to-ui
arch:
  - amd64
  - aarch64
  - armv7
init: false
ingress: true
ingress_port: 8099
panel_icon: mdi:swap-horizontal
panel_title: KNX YAML
map:
  - "config:rw"
  - "share:rw"
homeassistant_api: true
hassio_api: true
auth_api: true
options: {}
schema: {}
```

**Key choices explained:**
- `init: false` — we use s6-overlay (set up in Task 12), not the default init
- `ingress: true` + `ingress_port: 8099` — served via HA-Sidebar, no separate port mapping
- `map: [config:rw, share:rw]` — write-access to `/config/knx/` and `/share/`
- `homeassistant_api / hassio_api / auth_api: true` — supervisor injects `SUPERVISOR_TOKEN` env var for WS-Auth
- `options/schema` empty for now; will add later for user-config

- [ ] **Step 2: Commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add addon/config.yaml && git commit -m "feat(addon): add config.yaml manifest with ingress + supervisor-api"
```

---

## Task 11: Add Dockerfile

**Files:**
- Create: `addon/Dockerfile`
- Create: `addon/app/pyproject.toml`
- Create: `addon/app/main.py`
- Create: `addon/app/deps.py`
- Create: `addon/app/routers/__init__.py`
- Create: `addon/app/routers/health.py`

- [ ] **Step 1: Write minimal FastAPI app**

Create `C:/Users/user/tools/knx-yaml-to-ui/addon/app/main.py`:
```python
"""FastAPI entry point for knx-yaml-to-ui HA Add-on."""
from fastapi import FastAPI

from app.routers import health

app = FastAPI(
    title="knx-yaml-to-ui",
    version="0.0.1",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.include_router(health.router, prefix="/api")


@app.get("/api")
async def root() -> dict[str, str]:
    return {"status": "ok", "service": "knx-yaml-to-ui"}
```

- [ ] **Step 2: Write health router**

Create `C:/Users/user/tools/knx-yaml-to-ui/addon/app/routers/__init__.py` (empty file).

Create `C:/Users/user/tools/knx-yaml-to-ui/addon/app/routers/health.py`:
```python
"""Health + version endpoints."""
import os

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/version")
async def version() -> dict[str, str]:
    return {
        "addon_version": os.environ.get("ADDON_VERSION", "dev"),
        "core_version": "0.1.0",
    }
```

- [ ] **Step 3: Write deps.py stub**

Create `C:/Users/user/tools/knx-yaml-to-ui/addon/app/deps.py`:
```python
"""Shared dependencies — supervisor-token, HA-WS-client (stub until Slice 1)."""
import os


def get_supervisor_token() -> str | None:
    """Return the supervisor-token env var (injected by HA Add-on framework)."""
    return os.environ.get("SUPERVISOR_TOKEN")


def get_ha_url() -> str:
    """Default to supervisor proxy URL."""
    return os.environ.get("HA_URL", "http://supervisor/core")
```

- [ ] **Step 4: Write addon/app/pyproject.toml**

Create `C:/Users/user/tools/knx-yaml-to-ui/addon/app/pyproject.toml`:
```toml
[project]
name = "knx-yaml-to-ui-addon"
version = "0.0.1"
requires-python = ">=3.12"
dependencies = [
    "knx-yaml-to-ui-core",
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "httpx>=0.27",
    "websockets>=13.0",
    "pyyaml>=6.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "pytest-cov>=4.1",
    "httpx>=0.27",
    "ruff>=0.6",
    "mypy>=1.11",
]

[tool.uv.sources]
knx-yaml-to-ui-core = { path = "../../shared", editable = true }
```

- [ ] **Step 5: Write Dockerfile**

Create `C:/Users/user/tools/knx-yaml-to-ui/addon/Dockerfile`:
```dockerfile
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.20
FROM $BUILD_FROM

# Add-on metadata args (provided by builder)
ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_VERSION

ENV LANG=C.UTF-8 PYTHONUNBUFFERED=1

WORKDIR /app

# Copy package code
COPY ../shared /shared
COPY app /app/app

# Install with pip (uv requires extra setup in alpine)
RUN pip install --no-cache-dir \
        /shared \
        /app

# s6-overlay service definition
COPY rootfs /

EXPOSE 8099

# s6-overlay handles process supervision; init is provided by base image
LABEL \
    io.hass.name="knx-yaml-to-ui" \
    io.hass.version=$BUILD_VERSION \
    io.hass.type="addon" \
    io.hass.arch=$BUILD_ARCH
```

- [ ] **Step 6: Commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add addon/Dockerfile addon/app/ && git commit -m "feat(addon): scaffold FastAPI app with /api/health + /api/version + Dockerfile"
```

---

## Task 12: Add s6-overlay service definition

**Files:**
- Create: `addon/rootfs/etc/services.d/uvicorn/run`
- Create: `addon/rootfs/etc/services.d/uvicorn/finish`

- [ ] **Step 1: Write s6 run script**

Create `C:/Users/user/tools/knx-yaml-to-ui/addon/rootfs/etc/services.d/uvicorn/run`:
```bash
#!/usr/bin/with-contenv bashio
# ==============================================================================
# Start the FastAPI app via uvicorn
# ==============================================================================
bashio::log.info "Starting knx-yaml-to-ui uvicorn server on port 8099"

cd /app
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8099 \
    --no-access-log \
    --proxy-headers \
    --forwarded-allow-ips "*"
```

Make it executable:
```bash
chmod +x C:/Users/user/tools/knx-yaml-to-ui/addon/rootfs/etc/services.d/uvicorn/run
```

- [ ] **Step 2: Write s6 finish script**

Create `C:/Users/user/tools/knx-yaml-to-ui/addon/rootfs/etc/services.d/uvicorn/finish`:
```bash
#!/usr/bin/execlineb -S0
# ==============================================================================
# Take down the S6 supervision tree if uvicorn fails
# ==============================================================================
if -n { s6-test $# -ne 0 }
if -n { s6-test ${1} -eq 256 }

s6-svscanctl -t /var/run/s6/services
```

Make it executable:
```bash
chmod +x C:/Users/user/tools/knx-yaml-to-ui/addon/rootfs/etc/services.d/uvicorn/finish
```

- [ ] **Step 3: Commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add addon/rootfs/ && git commit -m "feat(addon): s6-overlay service definition for uvicorn"
```

---

## Task 13: Local Docker-build smoke-test

This task confirms the Dockerfile builds without errors and the resulting image starts uvicorn correctly. **Does not require a running HA instance** — we test the image in isolation.

- [ ] **Step 1: Verify Docker is running**

Run: `docker info | head -5`
Expected: shows Docker daemon info. If not running, start Docker Desktop and re-run.

- [ ] **Step 2: Build image (amd64)**

The Dockerfile uses `COPY ../shared /shared`, so build-context must be one level up. Run from the repo root:

```bash
cd C:/Users/user/tools/knx-yaml-to-ui && \
docker build \
    -f addon/Dockerfile \
    --build-arg BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.20 \
    --build-arg BUILD_ARCH=amd64 \
    --build-arg BUILD_VERSION=0.0.1 \
    --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -t knx-yaml-to-ui:dev \
    addon/
```

Wait — `COPY ../shared` won't work because the context is `addon/`. The Dockerfile needs adjustment OR build-context must be repo-root.

**Choose Option B: use repo-root as build context.** Update the Dockerfile:

Edit `C:/Users/user/tools/knx-yaml-to-ui/addon/Dockerfile`, change the COPY lines from:
```dockerfile
COPY ../shared /shared
COPY app /app/app
```
to:
```dockerfile
COPY shared /shared
COPY addon/app /app/app
COPY addon/rootfs /
```

And remove the original `COPY rootfs /` line that was further down (we moved it up to be paired with the explicit context).

Then build with repo-root as context:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && \
docker build \
    -f addon/Dockerfile \
    --build-arg BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.20 \
    --build-arg BUILD_ARCH=amd64 \
    --build-arg BUILD_VERSION=0.0.1 \
    --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -t knx-yaml-to-ui:dev \
    .
```

Expected: build completes, `Successfully tagged knx-yaml-to-ui:dev`.

- [ ] **Step 3: Run image locally**

Run:
```bash
docker run --rm -p 8099:8099 -e SUPERVISOR_TOKEN=dummy-test-token -e ADDON_VERSION=0.0.1 knx-yaml-to-ui:dev
```
Expected: uvicorn logs `Application startup complete.` and listens on `0.0.0.0:8099`.

- [ ] **Step 4: Smoke-test endpoints (in a second shell)**

Run:
```bash
curl http://localhost:8099/api/health
curl http://localhost:8099/api/version
curl http://localhost:8099/api
```
Expected:
- `{"status":"ok"}`
- `{"addon_version":"0.0.1","core_version":"0.1.0"}`
- `{"status":"ok","service":"knx-yaml-to-ui"}`

- [ ] **Step 5: Stop container**

In the first shell, Ctrl+C the docker-run.

- [ ] **Step 6: Commit fix**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add addon/Dockerfile && git commit -m "fix(addon): use repo-root as docker build context for shared/ access"
```

---

## Task 14: Install Add-on on real HA + verify Ingress

This is a **manual install task** — no automated test exists for "Add-on appears in HA-Sidebar". User confirmation required.

- [ ] **Step 1: Push the dev branch to a local file-share or temp git location**

Easiest: HA's "Local Add-ons" works via `/addons/` folder on the host. For Skynet-Home at `192.168.2.238`:

Run (on Windows):
```powershell
# Mount H:\ already shows the HA-Config. Copy addon into /addons/:
Copy-Item -Recurse C:\Users\user\tools\knx-yaml-to-ui\addon H:\addons\knx-yaml-to-ui
Copy-Item -Recurse C:\Users\user\tools\knx-yaml-to-ui\shared H:\addons\knx-yaml-to-ui\shared
```
(Yes, we duplicate `shared/` into the addon-dir for HA-supervisor build. The Dockerfile expects it.)

Wait — the HA Supervisor builds from the addon-dir alone. The Dockerfile we wrote needs **repo-root** context. For local-addon-install we need the Dockerfile to work with **addon-dir as context**.

**Fix:** Place `shared/` inside `addon/` for local-install OR adjust Dockerfile. Cleanest: HA-Supervisor convention uses self-contained addons. So duplicate `shared/` into `addon/shared/` at install-time. Adjust the Dockerfile to expect `shared/` at the build-context root.

Update `C:/Users/user/tools/knx-yaml-to-ui/addon/Dockerfile` COPY lines:
```dockerfile
COPY shared /shared
COPY app /app/app
COPY rootfs /
```

(So when build-context = `addon/`, with `shared/` symlinked or copied into `addon/shared/`, it just works. For our docker-build-test in Task 13 we'll need to copy `shared/` into `addon/shared/` first.)

- [ ] **Step 2: Adjust local docker-build to match**

Run (Windows PowerShell):
```powershell
cd C:\Users\user\tools\knx-yaml-to-ui
Remove-Item -Recurse -Force addon\shared -ErrorAction SilentlyContinue
Copy-Item -Recurse shared addon\shared
docker build -f addon\Dockerfile --build-arg BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.20 --build-arg BUILD_ARCH=amd64 --build-arg BUILD_VERSION=0.0.1 -t knx-yaml-to-ui:dev addon\
```
Expected: build succeeds.

Add `addon/shared/` to `.gitignore` (it's a copy, not authoritative):
```
# Edit C:/Users/user/tools/knx-yaml-to-ui/.gitignore — append:
addon/shared/
```

- [ ] **Step 3: Install on HA via Local-Add-ons folder**

Copy the addon dir to HA:
```powershell
# Use Windows tools/explorer or SMB share if H:\ is HA-config
Remove-Item -Recurse -Force H:\addons\knx-yaml-to-ui -ErrorAction SilentlyContinue
Copy-Item -Recurse C:\Users\user\tools\knx-yaml-to-ui\addon H:\addons\knx-yaml-to-ui
Copy-Item -Recurse C:\Users\user\tools\knx-yaml-to-ui\shared H:\addons\knx-yaml-to-ui\shared
```

- [ ] **Step 4: Reload Add-on Store + install**

In HA UI:
1. Settings → Add-ons → Add-on Store → menu (top-right) → "Check for updates"
2. Find "Local Add-ons" → "knx-yaml-to-ui" → Install
3. Wait for build (5-10 min first time, multi-arch base download)
4. Start the Add-on
5. Wait for "Started" state

Confirm via supervisor log: "Application startup complete."

- [ ] **Step 5: Open Add-on UI via Ingress**

In HA: Settings → Add-ons → knx-yaml-to-ui → "OPEN WEB UI" button (or sidebar icon with mdi:swap-horizontal).

Expected: blank page with `{"status":"ok","service":"knx-yaml-to-ui"}` (root API) — since we haven't built the frontend yet.

Browser-URL should be similar to `https://homeassistant.local:8123/hassio/ingress/<token>/`.

- [ ] **Step 6: Verify /api/health via Ingress**

In the same browser:
- Navigate to `<ingress-base-url>/api/health` → expect `{"status":"ok"}`
- Navigate to `<ingress-base-url>/api/version` → expect `{"addon_version":"0.0.1","core_version":"0.1.0"}`

- [ ] **Step 7: Commit gitignore + manual-test confirmation**

Update `C:/Users/user/tools/knx-yaml-to-ui/.gitignore` to ignore the build-copy:
```
# (append to existing)
addon/shared/
```

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add .gitignore && git commit -m "chore: ignore addon/shared build-time copy"
```

---

## Task 15: WS-API-Discovery Spike — Capture HA-KNX-UI WS Frames

This is the **risk-mitigation step** before committing to the WS-API approach. Output: `docs/active/webapp/ws-api-catalog.md` — a documented catalog of the HA-KNX WS commands we need.

**Source-of-truth approach (parallel):**

A. **HA source code** — `homeassistant/components/knx/websocket.py` shows all registered handlers
B. **Browser DevTools** — capture actual frames during HA-KNX-UI interactions

Doing both gives high confidence.

- [ ] **Step 1: Pull HA-KNX websocket.py source**

Run:
```bash
mkdir -p C:/Users/user/tools/knx-yaml-to-ui/docs/active/webapp/_spike
curl -L "https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/components/knx/websocket.py" -o C:/Users/user/tools/knx-yaml-to-ui/docs/active/webapp/_spike/ha_knx_websocket.py
```
Expected: file saved, ~10-30kb.

- [ ] **Step 2: Extract all `@websocket_api.websocket_command` decorators**

Run:
```bash
grep -nE "websocket_api.websocket_command|@callback|@websocket_api|async def ws_" C:/Users/user/tools/knx-yaml-to-ui/docs/active/webapp/_spike/ha_knx_websocket.py | head -50
```
Expected: list of WS-command schemas, each with a `vol.Schema` and a handler function.

- [ ] **Step 3: Document each command in ws-api-catalog.md**

Create `C:/Users/user/tools/knx-yaml-to-ui/docs/active/webapp/ws-api-catalog.md`:
```markdown
# HA-KNX WebSocket API Catalog

**Source:** `homeassistant/components/knx/websocket.py` from HA-dev branch (pulled YYYY-MM-DD).
**HA-Version tested:** [fill in after step 5]
**Status:** Spike output — risk-mitigation for Plan 02 (Slice 1).

## Required Commands

For our use case we need:

| Operation | Required Command | Status (filled below) |
|---|---|---|
| List KNX entity configs (all) | ?? | ?? |
| Get single entity config | ?? | ?? |
| Create new entity | per-domain `knx/create_<domain>` ?? | ?? |
| Update entity config | per-domain `knx/update_<domain>` ?? | ?? |
| Delete entity | per-domain `knx/delete_<domain>` ?? | ?? |
| Set device_class | `config/entity_registry/update` (standard HA) | ✅ documented |

## Commands Found in Source

(Fill in from the grep output. Format per command:)

### `<command_type>`
- **Handler:** `ws_<name>(hass, connection, msg)`
- **Schema fields:** `field1: vol.Required(...), field2: vol.Optional(...)`
- **Returns:** describe response shape
- **Notes:** any quirks

(Repeat for each command found.)

## Decision Point

After cataloging, answer for each domain we support (light, switch, cover, binary_sensor, sensor, climate, time, datetime):

- [ ] Can we **create** a KNX entity of this domain via WS?
- [ ] Can we **update** an existing KNX entity's config via WS?
- [ ] Can we **delete** an existing KNX entity via WS?
- [ ] Can we **read** an existing entity's current config via WS?

**If all 4 = yes for all 8 domains** → architecture confirmed, proceed with Plan 02 (Slice 1) using WS-only path.

**If any gap exists** → architecture-pivot: use `.storage`-direct-write + HA-reload-trigger for the gap-domains. Add Bugfix #7 (HA-Running-Check) back into scope.
```

- [ ] **Step 4: Read the source and fill in the table**

Open `docs/active/webapp/_spike/ha_knx_websocket.py` in editor. For each `websocket_command` decorator, document the command in `ws-api-catalog.md` per the template format.

Focus areas to look for:
- `vol.Required("type"): "knx/..."` — command identifier
- Handler signature — what fields are required vs optional
- Return-value (look for `connection.send_result(msg["id"], {...})`)

- [ ] **Step 5: Live-capture from running HA**

Open Skynet HA in Chrome/Edge: `http://192.168.2.238:8123`

1. F12 → Network tab → filter "WS" → click the websocket connection
2. Click the "Messages" sub-tab to see all WS frames
3. In HA: navigate to Settings → Devices & Services → KNX → click any entity → "Edit"
4. Modify a trivial field (rename, set+revert), click Save
5. In DevTools, find the frame with `type: "knx/..."` — that's the update command

Repeat for: Create, Delete, List.

- [ ] **Step 6: Document live-capture findings in ws-api-catalog.md**

For each captured frame, append to ws-api-catalog.md:
```markdown
### Live-captured: knx/<command>
- **Source:** Browser DevTools, HA 2026.5.3, KNX UI version 2.4
- **Request frame:** ```json
  {"id": N, "type": "knx/...", ...fields}
  ```
- **Response frame:** ```json
  {"id": N, "type": "result", "success": true, "result": {...}}
  ```
- **Matches source-code finding:** yes/no
```

- [ ] **Step 7: Make the architecture decision**

At the bottom of `ws-api-catalog.md`, fill in the "Decision Point" checkboxes. Then write a 1-paragraph "Decision Summary":

```markdown
## Decision Summary (YYYY-MM-DD)

WS-API surface is [complete / partially complete / insufficient] for our 8 supported domains.

[If complete] Plan 02 proceeds with WS-only approach as designed.

[If partial] Plan 02 proceeds with WS for domains [A, B, C], and `.storage`-direct-write fallback for [D, E]. Bugfix #7 (HA-Running-Check) added to Plan 02 scope.

[If insufficient] Architecture pivots to `.storage`-direct-write for all domains. Bugfix #7 mandatory. WS used only for state-read + entity-list (which definitely exists).
```

- [ ] **Step 8: Commit spike output**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add docs/active/webapp/_spike/ docs/active/webapp/ws-api-catalog.md && git commit -m "docs: WS-API discovery spike — catalog HA-KNX commands"
```

---

## Task 16: Plan-01 Wrap-Up — Update CI to include addon/

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add addon job to CI**

Edit `C:/Users/user/tools/knx-yaml-to-ui/.github/workflows/ci.yml` — append a new job:
```yaml
  addon-app:
    name: addon/app
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: addon/app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install uv
        run: pip install uv
      - name: Install package
        run: uv pip install --system -e ".[dev]"
      - name: Lint (ruff)
        run: ruff check app
      - name: Format check (ruff)
        run: ruff format --check app
      - name: Type check (mypy)
        run: mypy app

  addon-docker:
    name: addon/Dockerfile build (amd64)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Prepare shared copy
        run: cp -r shared addon/shared
      - name: Build Docker image
        run: |
          docker build \
            -f addon/Dockerfile \
            --build-arg BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.20 \
            --build-arg BUILD_ARCH=amd64 \
            --build-arg BUILD_VERSION=0.0.1 \
            -t knx-yaml-to-ui:ci \
            addon/
```

- [ ] **Step 2: Commit**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git add .github/workflows/ci.yml && git commit -m "ci: add addon lint + docker-build jobs"
```

---

## Task 17: Plan-01 Self-Verification

- [ ] **Step 1: Run full test-suite**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui/shared && .venv/Scripts/python.exe -m pytest --cov=knx_yaml_to_ui_core --cov-report=term
```
Expected: all tests pass, coverage ≥85% on `knx_yaml_to_ui_core`.

- [ ] **Step 2: Verify CLI still works end-to-end**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui/cli && .venv/Scripts/python.exe knx_yaml_to_ui.py list-backups
```
Expected: lists existing `.storage/knx/config_store.json.bak.*` files (or "no backups found").

- [ ] **Step 3: Verify Add-on is reachable from HA-Sidebar**

Visit the Add-on Ingress URL in HA (set up in Task 14). Confirm `{"status":"ok",...}` shows.

- [ ] **Step 4: Verify ws-api-catalog.md has the decision**

Open `docs/active/webapp/ws-api-catalog.md`. Confirm the "Decision Summary" section is filled in with a concrete decision (not still placeholder text).

- [ ] **Step 5: Tag Plan-01 completion**

Run:
```bash
cd C:/Users/user/tools/knx-yaml-to-ui && git tag -a v0.0.1-foundation -m "Plan 01 complete: foundation + addon scaffold + WS-API-Spike done"
```

---

## Done-Criteria for Plan 01

- [x] Git repo initialized with monorepo structure
- [x] CLI moved to `cli/` and refactored to import from `shared/knx_yaml_to_ui_core`
- [x] Shared core library has 2 modules (`ulid`, `slugify`) with 20+ tests, ≥85% coverage
- [x] Bugfix #3 (Umlaut transliteration) applied + tested
- [x] Add-on scaffold builds locally + multi-arch CI green
- [x] Add-on installs on Skynet HA + shows in Sidebar via Ingress
- [x] `/api/health`, `/api/version`, `/api` endpoints reachable via Ingress
- [x] WS-API-Discovery-Spike complete → `ws-api-catalog.md` with concrete decision
- [x] `v0.0.1-foundation` git-tag

**Next plan:** `2026-05-21-plan-02-mvp.md` for Slice 1 (Convert + Browser MVP). Writing it requires the WS-API-Catalog decision as input, which is why it's a separate plan written **after** Plan 01 finishes.

---

## Self-Review Notes

**Spec coverage:**
- Section 4.0 (Monorepo layout) → Tasks 1-4 ✅
- Section 4.1 (Backend skeleton) → Tasks 10-13 ✅ (partial: only `health.py` router, rest in Plan 02)
- Section 8 Phase 0a → Tasks 1-9 ✅
- Section 8 Phase 0b → Tasks 10-14 ✅
- Section 8 WS-API-Spike → Task 15 ✅
- Bugfix #3 → Task 7 ✅
- Section 9 Risk #1 (WS-API surface) → Task 15 spike output ✅

**Out-of-scope for Plan 01 (correctly deferred to later plans):**
- Bugfix #1, #2, #4–#13 → applied during Slice 1/2 (Plan 02/03)
- Frontend scaffold → Plan 02
- SQLite history → Plan 06
- License-Worker → Plan 07

**Placeholder scan:** clean — no TBD/TODO/"implement later". All code blocks are complete.

**Type consistency:** `get_supervisor_token() -> str | None` consistent across `deps.py` references. `gen_ulid() -> str` matches between `ulid.py` and `cli/knx_yaml_to_ui.py` use.
