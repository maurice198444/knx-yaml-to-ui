# Plan-03 Frontend Smoke Procedure — 2026-05-22

Run after `0.1.0` add-on is deployed on Skynet. Execute in browser at the
Ingress URL of the add-on; HA cookie auth required for `/api/*` + `/ws/*`.

Record results in `2026-05-22-plan-03-smoke.md` (same format as Plan-02).

---

## Preconditions

- [ ] Add-on `knx-yaml-to-ui` version `0.1.0` installed + started
- [ ] HA-Version + add-on log line `Serving frontend from /app/web` visible
- [ ] Browser DevTools open (Network + Console tabs)
- [ ] Test YAML present in `/config`: `light_test.yaml` (single light entity)

## Shell + Theme

- [ ] Open Ingress → shell loads, no console errors, no failed requests
- [ ] Topbar shows brand + 3 tabs (Konvertieren / Entitäten / Verlauf)
- [ ] Status-Pill rechts oben: green "verbunden" within ~2 s of load
- [ ] Theme toggle (sun/moon) flips light↔dark, repaints all surfaces
- [ ] Reload page → previously chosen theme persists (no FOUC)

## Routing

- [ ] Tab click navigates: hash updates `#convert` / `#entities` / `#history`
- [ ] Direct deep-link: open `<ingress>/#entities` cold → lands on Entitäten
- [ ] Back/Forward browser buttons traverse tabs correctly

## Convert Flow (Light)

- [ ] Konvertieren tab → 4 domain tiles + 4-step stepper
- [ ] Click `light` tile → tile highlighted, stepper step 1 active
- [ ] Step File → `light_test.yaml` listed; click row → step Parse loads
- [ ] Step Parse → meta shows 1 domain (light), 1 entity, raw_size > 0
- [ ] Step Dryrun → table with 1 row, status `ok` pill, "Daten anzeigen" reveals JSON payload
- [ ] Summary banner shows "1 Bereit zur Übernahme"
- [ ] Step Commit → button label `1 Entität übernehmen`, click triggers
- [ ] Success banner: "Übernahme erfolgreich · 1 Entität angelegt"
- [ ] New entity_id rendered in result list (e.g. `light.plan03_smoke_*`)
- [ ] Cleanup: remember the entity_id for fixture removal at end

## Entitäten Live

- [ ] Switch to Entitäten tab → group cards rendered (Licht, Sensoren, etc.)
- [ ] Each group shows entity count badge
- [ ] Click `Licht` group → slide-down expands rows; sibling card does NOT stretch
- [ ] Per-row: icon between expand-state and entity_id; state value rendered
- [ ] Toggle the smoke-light from HA's main UI (separate tab)
- [ ] Within ~1 s: row state flashes + value updates (an/aus) without page refresh
- [ ] Status-Pill remains "verbunden" throughout

## WS Reconnect

- [ ] Stop the add-on from HA (Supervisor → add-on → Stop)
- [ ] Within ~3 s: Status-Pill turns red "getrennt"
- [ ] Restart add-on; wait for container ready
- [ ] Pill transitions: red → orange "verbinde…" → green "verbunden"
- [ ] No JS errors, no infinite-loop reconnect spam in console

## Verlauf

- [ ] Switch to Verlauf tab → table shows the commit from earlier step
- [ ] Columns: # / Zeit / Bereich (Licht) / Status (Erfolgreich) / Einträge (1/1)
- [ ] Row-click expands inline; per-entry list shows ok pill + entity_id + file path
- [ ] Second commit (rerun the Convert flow on same YAML) appears at top
- [ ] Empty-state appears in a fresh browser session before any commits

## Bundle / Performance Sanity

- [ ] Network tab: 1× `index.html`, 1× CSS, 2× JS chunks (lit + index)
- [ ] All JS chunks gzipped total < 200 KB (current target: ~22 KB)
- [ ] No 404s, no CORS errors, no 401 on `/api/*` after Ingress auth handshake
- [ ] Console: zero errors, ≤1 informational message acceptable

## Cleanup

- [ ] Delete smoke entity via KNX integration in HA UI
- [ ] Remove `light_test.yaml` rerun-suffix fixtures if any were created
- [ ] Stop add-on if leaving idle

---

## Pass Criteria

All boxes above checked. Any unchecked item → file finding in result doc and
either fix-forward (small) or open a follow-up issue (larger).
