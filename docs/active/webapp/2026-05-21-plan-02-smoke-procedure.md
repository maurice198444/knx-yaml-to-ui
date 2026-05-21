# Plan-02 Smoke Test — Run Procedure

> Manual smoke test against Skynet HA. Backend MVP for KNX light domain end-to-end.
> Branch: `feature/plan-02-backend-mvp`. Run after merge to main or from feature branch.

## Pre-flight

- 27 backend tests green locally (last verified: 2026-05-21).
- Worktree clean, last commit `066c179 ci: add backend-integration job...`.

## Step 1 — Build Add-on image

```bash
cd C:/Users/user/tools/knx-yaml-to-ui
cp -r shared addon/shared   # docker context needs shared next to addon/
docker buildx build \
  --platform linux/amd64 \
  --build-arg BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.20 \
  --build-arg BUILD_ARCH=amd64 \
  --build-arg BUILD_VERSION=0.0.2 \
  -t local/knx-yaml-to-ui:dev \
  --load \
  -f addon/Dockerfile addon/
```

Expected: build succeeds, image `local/knx-yaml-to-ui:dev` present.

## Step 2 — Install on Skynet HA

Copy `addon/` tree into HA `/addons/local/knx-yaml-to-ui/` share (same procedure as Plan-01 Task 13). Reload Add-on store → Install.

## Step 3 — Provision fixture YAML

On HA host, place `/config/knx/light_test.yaml`:

```yaml
light:
  - name: Plan02 Smoke Diele
    address: 1/0/200
    state_address: 1/5/200
```

## Step 4 — Curl smoke (from HA terminal addon)

```bash
INGRESS=http://localhost:8123/api/hassio_ingress/<TOKEN>  # token from Add-on UI

curl -s $INGRESS/api/health | jq
curl -s $INGRESS/api/yaml/files | jq
curl -s "$INGRESS/api/yaml/parse?path=light_test.yaml" | jq
curl -s -X POST $INGRESS/api/convert/dry-run \
  -H "Content-Type: application/json" \
  -d '{"path":"light_test.yaml","domain":"light"}' | jq
curl -s -X POST $INGRESS/api/convert/commit \
  -H "Content-Type: application/json" \
  -d '{"path":"light_test.yaml","domain":"light"}' | jq
curl -s $INGRESS/api/entities | jq
```

Expected: each → 200. Commit response → `entity_id: light.plan02_smoke_diele`.

## Step 5 — Verify entity in HA

HA → Settings → Devices & Services → Entities → search "Plan02". Must exist with `knx` platform.

## Step 6 — WS smoke

```bash
wscat -c "ws://<ha-host>:8123/api/hassio_ingress/<token>/ws/state-stream"
# Toggle light.plan02_smoke_diele in HA UI
# Expected JSON event: {"entity_id":"light.plan02_smoke_diele","state":"on","attributes":{...}}
```

## Step 7 — Record result

After smoke passes, create `docs/active/webapp/2026-05-21-plan-02-smoke.md`:

```markdown
# Plan-02 Smoke Test Result — 2026-05-DD

HA-Version: 2026.5.x

- [x] /api/health 200
- [x] /api/yaml/files 200, light_test.yaml listed
- [x] /api/yaml/parse 200, 1 domain (light), 1 entity (Plan02 Smoke Diele)
- [x] /api/convert/dry-run 200, ok
- [x] /api/convert/commit 200, entity_id=light.plan02_smoke_diele, applied=true
- [x] Entity visible in HA UI
- [x] /ws/state-stream JSON event on toggle

Migration row id: <N>
```

Then commit + tag:

```bash
git add docs/active/webapp/2026-05-21-plan-02-smoke.md
git commit -m "docs(webapp): record plan-02 manual smoke test against Skynet HA"
git tag -a v0.0.2-backend-mvp -m "Plan 02 complete: backend MVP for light domain"
```

## Rollback if smoke fails

- HA → Settings → Devices & Services → KNX → remove the test entity manually.
- Delete `/config/knx/light_test.yaml`.
- Uninstall the Add-on.
- File bug under `docs/active/webapp/` and fix before re-attempting Task 17 tag.
