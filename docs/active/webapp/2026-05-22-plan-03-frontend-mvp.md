# knx-yaml-to-ui — Plan 03: Frontend MVP (Lit + Vite)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax in `2026-05-22-plan-03-tasks.md`.

**Goal:** Build the user-facing frontend for the add-on so a HA user can actually use it from the Ingress panel. After Plan-02 the backend works end-to-end via curl/DevTools-fetch, but `https://…/api/hassio_ingress/<slug>/` returns `{"detail":"Not Found"}` because no UI is served. This plan ships the UI.

**Architecture:** Lit 3 + Vite 5 + TypeScript in a new `addon/web/` tree. Build output (`addon/web/dist/`) is copied into the container image and served by FastAPI via `StaticFiles` + a catch-all `/` route that returns `index.html` (SPA-routing fallback). The frontend uses two clients: a typed `apiClient` for `/api/*` REST calls and a `wsClient` for `/ws/state-stream`. All Plan-02 endpoints stay unchanged.

**Design Direction:** Locked to user-authored mockups `docs/active/webapp/plan-03-mockups/mockup-1-ha-native.html` (Light) + `mockup-3-dark.html` (Dark). Domain-first navigation (Licht / Sensoren / Rolladen / Heizung tiles), 3 top-tabs (Convert / Entities / History), inline Stepper in the Convert tab (no modal), Roboto + Roboto Mono, lucide-style SVG icons. Light + Dark are merged in implementation via CSS-variable theme switching driven by `data-theme` attribute on `<html>` (auto follows `prefers-color-scheme`, manual override in topbar).

**Tech Stack:**
- Lit 3 (`lit`, `@lit/reactive-element`)
- TypeScript 5 (strict)
- Vite 5 (dev server + production build)
- pnpm for package management
- @lit/context for app-wide state
- No Web-Component framework on top of Lit (no Shoelace, no Material) — design tokens + custom elements
- No router lib — tiny hash-based router in `~30 LOC` (3 tabs only)

**Predecessor:** `2026-05-21-plan-02-backend-mvp.md` (tagged `v0.0.3-backend-mvp`)
**Successor:** TBD (Plan-04 — domain coverage expansion: switch / climate / cover / sensor)

**Scope Notes:**
- One domain wired end-to-end in the UI — `light` — matches Plan-02 backend scope. Other domain tiles render as disabled "coming soon" with the entity-count badge populated from `/api/entities` already (visual completeness, no Convert-flow yet).
- No edit-in-place YAML editor. Files are read-only previews.
- No login/auth screen — Ingress session cookie is the only auth.
- No i18n — German strings inline; abstraction layer deferred.
- No offline support, no service worker.
- Bundle size budget: < 200 KB gzipped for `index.html` + first JS chunk.

---

## File Map

### addon/web/ (new tree)

| File | Responsibility |
|---|---|
| `package.json` | pnpm scripts (`dev`, `build`, `lint`, `typecheck`), pinned deps |
| `pnpm-lock.yaml` | committed |
| `tsconfig.json` | strict, ES2022, `noUncheckedIndexedAccess: true` |
| `vite.config.ts` | base `./` (Ingress serves under variable prefix), proxy `/api` + `/ws` to localhost:8099 in dev |
| `.eslintrc.cjs` | + lit-plugin rules |
| `index.html` | shell + theme bootstrap (read `data-theme` from localStorage before first paint) |
| `src/main.ts` | mount `<knx-app>` root |
| `src/styles/tokens.css` | Design tokens (light + dark via `[data-theme]` selectors), extracted from mockups |
| `src/styles/reset.css` | Minimal reset + Roboto import |
| `src/router.ts` | Hash router: `#convert` (default) / `#entities` / `#history` |
| `src/theme.ts` | `getTheme()`, `setTheme()`, `subscribeSystemTheme()` — drives `data-theme` |
| `src/state/store.ts` | Lit Context for app state (currently-selected file, dry-run result, entities) |
| `src/api/client.ts` | Typed fetch wrapper, `credentials: 'include'` (Ingress cookie) |
| `src/api/types.ts` | Generated/hand-rolled types matching Plan-02 Pydantic schemas |
| `src/api/ws.ts` | `WsClient` with auto-reconnect (exponential backoff, max 30 s) |
| `src/components/knx-app.ts` | Root layout: `<knx-topbar>` + `<router-outlet>` |
| `src/components/knx-topbar.ts` | Brand + tabs + theme-toggle + connection-status |
| `src/components/knx-tabs.ts` | Generic tab-bar (reused) |
| `src/views/convert-view.ts` | Convert tab: domain-tiles + stepper + step-content |
| `src/views/convert/domain-tiles.ts` | 4 domain cards w/ entity counts |
| `src/views/convert/stepper.ts` | Inline 4-step stepper |
| `src/views/convert/step-file.ts` | Pick YAML file (list from `/api/yaml/files`) |
| `src/views/convert/step-parse.ts` | Parse output (count, raw_size) |
| `src/views/convert/step-dryrun.ts` | Dry-run table + per-entry status |
| `src/views/convert/step-commit.ts` | Summary + commit + success state |
| `src/views/entities-view.ts` | Entity list + WS live updates + delete-selected |
| `src/views/history-view.ts` | Migration history (initially shows commit results from session; full DB-list deferred) |
| `src/components/ui/btn.ts` | `<knx-btn variant="primary\|ghost\|text">` |
| `src/components/ui/pill.ts` | `<knx-pill kind="ok\|err\|warn">` |
| `src/components/ui/card.ts` | `<knx-card>` |
| `src/components/ui/icon.ts` | `<knx-icon name="…">` — lucide-icons subset (inline SVG, tree-shaken) |
| `src/components/ui/live-dot.ts` | Pulsing dot |
| `tests/router.test.ts` | Hash routing + back/forward |
| `tests/api-client.test.ts` | Fetch wrapper error paths |
| `tests/ws-client.test.ts` | Reconnect backoff |

### addon/app/ (backend change)

| File | Change |
|---|---|
| `main.py` | Mount `StaticFiles(directory="/app/web")` at `/static`, add catch-all `GET /{full_path:path}` → `FileResponse(index.html)` (SPA-fallback). Must NOT intercept `/api/*` or `/ws/*` (define routers first). |

### addon/ (build pipeline)

| File | Change |
|---|---|
| `Dockerfile` | New stage `frontend-builder`: `node:20-alpine`, `pnpm install --frozen-lockfile`, `pnpm build`. Copy `dist/` into final python image at `/app/web/`. |
| `.dockerignore` | Add `web/node_modules`, `web/dist` |
| `config.yaml` | Bump `version: "0.1.0"` (first usable UI = minor) |

### CI

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Add `frontend` job: pnpm install + lint + typecheck + build (artifact size assert < 200 KB gz). Add to required-checks. |

### docs

| File | Status |
|---|---|
| `docs/active/webapp/plan-03-mockups/*.html` | Reference only — kept in repo, not in image. |
| `docs/active/webapp/2026-05-22-plan-03-tasks.md` | New — granular task checklist |
| `docs/active/webapp/2026-05-22-plan-03-smoke-procedure.md` | New, written end of P5 |

---

## Done-Criteria for Plan 03

- [ ] Opening the Ingress panel renders the Convert tab (not `{"detail":"Not Found"}`)
- [ ] All 3 tabs (Convert / Entities / History) reachable, deep-link via `#hash`
- [ ] Theme-toggle switches light ↔ dark, persists in `localStorage`, follows `prefers-color-scheme` on first load
- [ ] Convert flow for `light` domain works end-to-end from UI: domain-tile click → file pick → parse → dry-run → commit → entity appears in Entities tab live (WS)
- [ ] Entities tab shows a list of KNX entities via `/api/entities`; state column updates live without page reload
- [ ] History tab shows commits from the current session at minimum (DB-backed full history is a P4 stretch)
- [ ] Frontend bundle gzipped < 200 KB; verified in CI
- [ ] No console errors in production build; no failed network requests on golden path
- [ ] Lint + typecheck green; ≥60% test coverage for non-trivial logic (router, api-client, ws-client)
- [ ] Add-on version `0.1.0` builds, installs on Skynet HA, smoke procedure passes
- [ ] PR merged to `main`; tag `v0.1.0-frontend-mvp`

---

## Design Tokens (extracted from mockups)

```css
/* tokens.css */
[data-theme="light"] {
  --accent: #03a9f4;
  --accent-dark: #0288d1;
  --bg: #f5f7f9;
  --surface: #ffffff;
  --border: #e3e7eb;
  --text: #212121;
  --text-secondary: #5f6c7b;
  --text-tertiary: #8a96a3;
  --ok: #22a45d;  --ok-bg: #e7f6ee;
  --err: #db4437; --err-bg: #fcebea;
  --warn: #f5a623; --warn-bg: #fef5e7;
  --radius: 12px;
  --shadow: 0 1px 2px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.04);
}
[data-theme="dark"] {
  --accent: #38bdf8;
  --accent-soft: rgba(56,189,248,.1);
  --accent-line: rgba(56,189,248,.28);
  --bg: #0e1116;
  --surface: #161a21;
  --surface-2: #1c212a;
  --border: #262c36;
  --border-strong: #333b47;
  --text: #e6e9ee;
  --text-secondary: #99a2af;
  --text-tertiary: #6a7280;
  --ok: #4ade80;  --ok-bg: rgba(74,222,128,.12);
  --err: #f87171; --err-bg: rgba(248,113,113,.12);
  --warn: #fbbf24; --warn-bg: rgba(251,191,36,.12);
  --radius: 13px;
  --shadow: 0 1px 2px rgba(0,0,0,.4);
}
```

Domain-accent colors (Light only — Dark uses uniform accent):
```css
[data-theme="light"] {
  --d-light: #f5a623;   --d-light-bg: #fef3e0;
  --d-sensor: #03a9f4;  --d-sensor-bg: #e3f4fd;
  --d-cover: #7e57c2;   --d-cover-bg: #f0eafa;
  --d-climate: #ef5350; --d-climate-bg: #fdeded;
}
```

---

## Routing Model

Hash-based, ~30 LOC:

```
#                  → redirect to #convert
#convert           → ConvertView (default)
#convert/file/:p   → ConvertView w/ selected file, stepper at "Parse"
#convert/dryrun    → stepper at "Dry-Run"
#convert/commit    → stepper at "Commit"
#entities          → EntitiesView
#history           → HistoryView
```

Browser back/forward must work without state loss for current step. Selected file persisted in `sessionStorage` so refresh in mid-flow doesn't reset.

---

## State Management

One Lit Context (`appContext`), no Redux/Zustand. Shape:

```ts
type AppState = {
  files: YamlFileSummary[] | null;
  selectedFile: string | null;
  parseResult: ParseResult | null;
  dryRunResult: DryRunResult | null;
  entities: EntitySummary[];
  liveStates: Record<string, EntityState>;   // updated from WS
  recentCommits: CommitResponse[];           // session-local for History v1
  theme: "light" | "dark" | "auto";
  wsStatus: "connecting" | "open" | "closed";
};
```

Mutations via plain functions on the store; subscribers re-render through Lit reactive properties bound via `@consume()`.

---

## API & WS Clients

**`api/client.ts`** — typed wrappers:
```ts
api.health()
api.yaml.list()
api.yaml.parse(path)
api.convert.dryRun(req)
api.convert.commit(req)
api.entities.list()
api.entities.delete(entityId)   // P3 — verify backend supports
```

All requests use `credentials: 'include'` (Ingress session cookie). On 401, force a hard reload (Ingress will re-issue cookie). On 5xx, surface `<knx-toast variant="err">` with backend message.

**`api/ws.ts`** — `WsClient`:
- Connects to `/ws/state-stream` (no `/api/` prefix — see Plan-02 smoke findings)
- Exponential reconnect backoff: 1 s → 2 s → 4 s → 8 s → 16 s → 30 s (capped)
- Emits `{entity_id, state, attributes, last_changed}` to subscribers
- Exposes `status` reactive prop for the topbar live-dot

---

## Phases

### P1 — Skeleton + Theme (~3 h)
- Vite scaffold, `pnpm install`, `pnpm dev` serves blank `<knx-app>`
- Token CSS + theme.ts + topbar with theme-toggle working
- Hash router with 3 empty views
- FastAPI catch-all + StaticFiles mount; verify Ingress panel renders
- Dockerfile build stage proven (image builds locally)

### P2 — Convert Flow (~5 h)
- Domain-tiles with hardcoded counts first, then wired to `/api/entities`
- Stepper component + 4 steps as separate Lit elements
- step-file: list from `/api/yaml/files`, click → next step
- step-parse: call `/api/yaml/parse?path=`, show count + raw_size, "Continue →"
- step-dryrun: call `/api/convert/dry-run`, render table from mockup
- step-commit: confirm modal-less inline, call `/api/convert/commit`, success state with newly created entity_ids

### P3 — Entities + WS Live (~3 h)
- entities-view: `/api/entities` list, "delete selected" hits backend
- WsClient connect on view-mount, subscribe to `state_changed`
- Live-dot in topbar reflects `ws.status`
- Last-update timestamps in entity rows

### P4 — History (~2 h)
- v1: render `recentCommits` from store (session-local)
- v2 (stretch): backend exposes `GET /api/migrations` from sqlite, list it
- Filter dropdowns (kind, status) — non-functional v1, functional v2

### P5 — Polish + Smoke (~3 h)
- Bundle-size audit, code-split if needed
- Lighthouse pass: no broken accessibility tree, contrast OK in both themes
- All console errors silenced in production build
- Write `2026-05-22-plan-03-smoke-procedure.md` + execute on Skynet HA
- Tag `v0.1.0-frontend-mvp`, PR, merge

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Ingress base-path varies per session (`/api/hassio_ingress/<token>/`) | Vite `base: './'` + all asset refs relative + use `import.meta.url` for fetch base derivation |
| HA Ingress strips/rewrites WS upgrade headers | Already verified working in Plan-02 smoke; if regression, fall back to long-polling `GET /api/entities` every 2 s |
| `prefers-color-scheme` in iframe inherits parent theme but parent theme change doesn't notify | Listen on `matchMedia` in iframe; HA-frontend theme change reloads iframe anyway, so cold start covers it |
| Bundle bloat from Lit + lucide icons | Use only the ~12 icons we need, inline them; Lit core is already ~5 KB gz |
| Build pipeline doubles Docker build time | Multi-stage cache + `pnpm fetch` so deps cache layer stays warm |
| User clicks "Update" on add-on while we're mid-deploy (Plan-02 lesson) | Document in smoke procedure: rebuild local, don't push to GH-Pages add-on repo until ready |

---

## Open Decisions (resolved 2026-05-22)

- [x] **Icon set:** lucide subset (~12 icons), inline SVG, tree-shaken.
- [x] **History v1 scope:** session-only. `recentCommits` lives in store; no DB endpoint added in Plan-03.
- [x] **Delete entity from UI:** `entities.py` has GET only (no DELETE). P3 adds `DELETE /api/entities/{entity_id}` calling HA-WS `knx/delete_entity`.

---

## Non-Goals (explicit)

- WYSIWYG YAML editor
- Multi-domain Convert (only `light` actually creates entities)
- User preferences beyond theme
- Internationalization
- Test coverage on UI render output (snapshot tests deferred)
- E2E browser tests (Playwright) — manual smoke only for MVP
