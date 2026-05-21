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
