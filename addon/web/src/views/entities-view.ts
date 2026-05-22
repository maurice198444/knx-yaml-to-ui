import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../components/ui/card.js";
import "../components/ui/btn.js";
import "../components/ui/icon.js";
import type { IconName } from "../components/ui/icon.js";
import { api, ApiClientError } from "../api/client.js";
import { ws } from "../api/ws.js";
import type { StateEvent } from "../api/ws.js";
import type { EntitySummary } from "../api/types.js";
import type { LiveStatus } from "../components/ui/live-dot.js";

interface LiveSnapshot {
  state: string | null;
  unit: string | null;
  lastChanged: string | null;
}

interface GroupSpec {
  id: string;
  label: string;
  icon: IconName;
  prefixes: string[];
  color: "light" | "sensor" | "cover" | "climate" | "neutral";
}

const GROUPS: GroupSpec[] = [
  { id: "light", label: "Licht", icon: "lightbulb", prefixes: ["light"], color: "light" },
  { id: "switch", label: "Schalter", icon: "power", prefixes: ["switch"], color: "light" },
  {
    id: "sensor",
    label: "Sensoren",
    icon: "activity",
    prefixes: ["sensor", "binary_sensor"],
    color: "sensor",
  },
  { id: "cover", label: "Rolladen", icon: "layout", prefixes: ["cover"], color: "cover" },
  {
    id: "climate",
    label: "Heizung",
    icon: "thermometer",
    prefixes: ["climate"],
    color: "climate",
  },
  {
    id: "time",
    label: "Zeit",
    icon: "clock",
    prefixes: ["time", "datetime"],
    color: "neutral",
  },
  { id: "other", label: "Sonstige", icon: "file", prefixes: [], color: "neutral" },
];

const STATE_LABELS: Record<string, string> = {
  on: "an",
  off: "aus",
  unknown: "unbekannt",
  unavailable: "nicht verfügbar",
  idle: "inaktiv",
  active: "aktiv",
  heat: "heizen",
  cool: "kühlen",
  heat_cool: "heizen/kühlen",
  auto: "automatisch",
  fan_only: "nur lüfter",
  dry: "entfeuchten",
  heating: "heizt",
  cooling: "kühlt",
  open: "offen",
  closed: "geschlossen",
  opening: "öffnet",
  closing: "schließt",
  home: "zuhause",
  not_home: "abwesend",
  detected: "erkannt",
  not_detected: "nicht erkannt",
  locked: "gesperrt",
  unlocked: "entsperrt",
  none: "—",
};

function translateState(value: string | null): string {
  if (value === null) return "—";
  return STATE_LABELS[value.toLowerCase()] ?? value;
}

function entityPrefix(entityId: string): string {
  return entityId.split(".", 1)[0] ?? "";
}

function groupForPrefix(prefix: string): GroupSpec {
  for (const g of GROUPS) {
    if (g.prefixes.includes(prefix)) return g;
  }
  return GROUPS[GROUPS.length - 1]!; // "other"
}

@customElement("entities-view")
export class EntitiesView extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 26px;
      font-weight: 500;
    }
    p.lede {
      color: var(--text-secondary);
      margin: 0 0 20px;
    }
    .top-row {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 18px;
    }
    .top-row .status {
      font-size: 13px;
      color: var(--text-secondary);
    }
    .top-row .right {
      margin-left: auto;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      align-items: start;
    }
    @media (max-width: 820px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    .group {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .group-head {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      cursor: pointer;
      user-select: none;
      background: none;
      border: 0;
      width: 100%;
      font: inherit;
      color: inherit;
      text-align: left;
      transition: background 0.15s;
    }
    .group-head:hover {
      background: var(--surface-2);
    }
    .group-head .icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-size: 20px;
      flex-shrink: 0;
    }
    .group-head .icon.light {
      background: var(--d-light-bg);
      color: var(--d-light);
    }
    .group-head .icon.sensor {
      background: var(--d-sensor-bg);
      color: var(--d-sensor);
    }
    .group-head .icon.cover {
      background: var(--d-cover-bg);
      color: var(--d-cover);
    }
    .group-head .icon.climate {
      background: var(--d-climate-bg);
      color: var(--d-climate);
    }
    .group-head .icon.neutral {
      background: var(--surface-2);
      color: var(--text-secondary);
    }
    .group-head .label {
      font-size: 16px;
      font-weight: 500;
    }
    .group-head .count {
      margin-left: auto;
      font-family: var(--mono);
      font-size: 18px;
      font-weight: 700;
      color: var(--text);
    }
    .group-head .chev {
      color: var(--text-tertiary);
      font-size: 18px;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .group.open .group-head .chev {
      transform: rotate(90deg);
    }
    .group-body {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.32s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .group.open .group-body {
      grid-template-rows: 1fr;
    }
    .group-body > .inner {
      overflow: hidden;
      min-height: 0;
    }
    .row {
      display: grid;
      grid-template-columns: 26px minmax(0, 1.6fr) minmax(0, 1fr) auto 96px;
      align-items: center;
      gap: 14px;
      padding: 12px 20px;
      border-top: 1px solid var(--border);
      font-size: 14px;
      transition: background 0.15s;
    }
    .row:hover {
      background: var(--surface-2);
    }
    .row.updated {
      animation: rowflash 1.2s ease-out;
    }
    @keyframes rowflash {
      0% {
        background: var(--accent-soft);
      }
      100% {
        background: transparent;
      }
    }
    .row .r-icon {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      font-size: 13px;
      flex-shrink: 0;
    }
    .row .r-icon.light {
      background: var(--d-light-bg);
      color: var(--d-light);
    }
    .row .r-icon.sensor {
      background: var(--d-sensor-bg);
      color: var(--d-sensor);
    }
    .row .r-icon.cover {
      background: var(--d-cover-bg);
      color: var(--d-cover);
    }
    .row .r-icon.climate {
      background: var(--d-climate-bg);
      color: var(--d-climate);
    }
    .row .r-icon.neutral {
      background: var(--surface-2);
      color: var(--text-secondary);
    }
    .eid {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stateval {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .stateval.on {
      color: var(--ok);
      font-weight: 500;
    }
    .stateval.warn {
      color: var(--warn);
      font-weight: 500;
    }
    .stateval.dim {
      color: var(--text-tertiary);
    }
    .stateval .unit {
      opacity: 0.7;
      margin-left: 3px;
    }
    .source {
      font-family: var(--mono);
      font-size: 12px;
      color: var(--text-tertiary);
      letter-spacing: 0.3px;
      text-transform: lowercase;
    }
    .lastup {
      font-family: var(--mono);
      font-size: 12px;
      color: var(--text-tertiary);
      text-align: right;
    }
    .empty-group {
      padding: 16px 20px;
      border-top: 1px solid var(--border);
      color: var(--text-tertiary);
      font-style: italic;
      font-size: 13px;
    }
    .loading,
    .error,
    .empty {
      padding: 28px;
      text-align: center;
      color: var(--text-tertiary);
    }
    .error {
      color: var(--err);
    }
  `;

  @state() private entities: EntitySummary[] = [];
  @state() private liveStates = new Map<string, LiveSnapshot>();
  @state() private recentlyUpdated = new Set<string>();
  @state() private openGroups = new Set<string>();
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private wsStatus: LiveStatus = ws.status;

  private flashTimers = new Map<string, number>();
  private onWsState = (e: Event) => {
    const detail = (e as CustomEvent<StateEvent>).detail;
    if (!detail.entity_id) return;
    const next = new Map(this.liveStates);
    const unit = (detail.attributes?.["unit_of_measurement"] as string | undefined) ?? null;
    next.set(detail.entity_id, {
      state: detail.state,
      unit,
      lastChanged: detail.last_changed,
    });
    this.liveStates = next;
    const flashed = new Set(this.recentlyUpdated);
    flashed.add(detail.entity_id);
    this.recentlyUpdated = flashed;
    const prev = this.flashTimers.get(detail.entity_id);
    if (prev !== undefined) clearTimeout(prev);
    this.flashTimers.set(
      detail.entity_id,
      window.setTimeout(() => {
        const cleared = new Set(this.recentlyUpdated);
        cleared.delete(detail.entity_id);
        this.recentlyUpdated = cleared;
        this.flashTimers.delete(detail.entity_id);
      }, 1200),
    );
  };
  private onWsStatusChange = () => {
    this.wsStatus = ws.status;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    ws.addEventListener("state", this.onWsState);
    ws.addEventListener("status", this.onWsStatusChange);
    ws.connect();
    void this.refresh();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    ws.removeEventListener("state", this.onWsState);
    ws.removeEventListener("status", this.onWsStatusChange);
    ws.close();
    for (const t of this.flashTimers.values()) clearTimeout(t);
    this.flashTimers.clear();
  }

  private async refresh(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const res = await api.entities.list();
      this.entities = res.entities;
    } catch (err) {
      this.error = err instanceof ApiClientError ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private toggleGroup(id: string): void {
    const next = new Set(this.openGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.openGroups = next;
  }

  private formatTime(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour12: false });
  }

  private stateValClass(value: string | null): string {
    if (!value) return "stateval dim";
    const v = value.toLowerCase();
    if (v === "on" || v === "open" || v === "home" || v === "detected" || v === "unlocked")
      return "stateval on";
    if (
      v === "heat" ||
      v === "cool" ||
      v === "heating" ||
      v === "cooling" ||
      v === "opening" ||
      v === "closing"
    )
      return "stateval warn";
    if (v === "unknown" || v === "unavailable") return "stateval dim";
    return "stateval";
  }

  private renderStateValue(value: string | null, unit: string | null) {
    if (value === null) return html`—`;
    const isNumeric = unit !== null && !Number.isNaN(Number(value));
    const display = isNumeric ? value : translateState(value);
    if (unit) return html`${display}<span class="unit">${unit}</span>`;
    return html`${display}`;
  }

  private iconForEntity(entityId: string): { icon: IconName; kind: string } {
    const prefix = entityPrefix(entityId);
    const group = groupForPrefix(prefix);
    // Binary sensor gets a distinct glyph from analog sensor.
    if (prefix === "binary_sensor") return { icon: "alert-circle", kind: group.color };
    if (prefix === "switch") return { icon: "power", kind: group.color };
    return { icon: group.icon, kind: group.color };
  }

  private groupedEntities(): Map<string, EntitySummary[]> {
    const buckets = new Map<string, EntitySummary[]>();
    for (const g of GROUPS) buckets.set(g.id, []);
    for (const e of this.entities) {
      const grp = groupForPrefix(entityPrefix(e.entity_id));
      buckets.get(grp.id)!.push(e);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
    }
    return buckets;
  }

  private statusLine(total: number) {
    if (this.wsStatus === "open") return html`Live · ${total} Entitäten`;
    if (this.wsStatus === "connecting") return html`Verbinde…`;
    return html`Offline · ${total} Entitäten`;
  }

  override render() {
    const total = this.entities.length;
    const grouped = this.groupedEntities();
    return html`
      <h1>KNX-Entitäten</h1>
      <p class="lede">
        Nach Bereich gruppiert. Klick auf Gruppe öffnet Liste mit Live-Status.
        Löschen erfolgt direkt in der KNX-Integration.
      </p>
      <div class="top-row">
        <span class="status">${this.statusLine(total)}</span>
        <div class="right">
          <knx-btn variant="ghost" @click=${this.refresh} ?disabled=${this.loading}>
            <knx-icon name="refresh"></knx-icon>Aktualisieren
          </knx-btn>
        </div>
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : nothing}
      ${this.loading && total === 0
        ? html`<div class="loading">Lade Entitäten…</div>`
        : total === 0
          ? html`<div class="empty">
              Keine KNX-Entitäten gefunden. Lege welche im Konvertieren-Tab an.
            </div>`
          : html`
              <div class="grid">
                ${GROUPS.filter((g) => (grouped.get(g.id)?.length ?? 0) > 0).map(
                  (g) => this.renderGroup(g, grouped.get(g.id) ?? []),
                )}
              </div>
            `}
    `;
  }

  private renderGroup(group: GroupSpec, items: EntitySummary[]) {
    const open = this.openGroups.has(group.id);
    return html`
      <div class="group ${open ? "open" : ""}">
        <button class="group-head" @click=${() => this.toggleGroup(group.id)}>
          <span class="icon ${group.color}">
            <knx-icon .name=${group.icon}></knx-icon>
          </span>
          <span class="label">${group.label}</span>
          <span class="count">${items.length}</span>
          <span class="chev"><knx-icon name="chevron-right"></knx-icon></span>
        </button>
        <div class="group-body">
          <div class="inner">
            ${items.length === 0
              ? html`<div class="empty-group">Keine Entitäten in dieser Gruppe.</div>`
              : items.map((e) => this.renderRow(e))}
          </div>
        </div>
      </div>
    `;
  }

  private renderRow(e: EntitySummary) {
    const live = this.liveStates.get(e.entity_id);
    const stateValue = live?.state ?? e.state ?? null;
    const unit = live?.unit ?? e.unit_of_measurement ?? null;
    const lastChanged = live?.lastChanged ?? e.last_changed ?? null;
    const flash = this.recentlyUpdated.has(e.entity_id) ? "updated" : "";
    const ic = this.iconForEntity(e.entity_id);
    return html`
      <div class="row ${flash}">
        <span class="r-icon ${ic.kind}">
          <knx-icon .name=${ic.icon}></knx-icon>
        </span>
        <span class="eid" title=${e.entity_id}>${e.entity_id}</span>
        <span class=${this.stateValClass(stateValue)}>
          ${this.renderStateValue(stateValue, unit)}
        </span>
        <span class="source">${e.platform || "knx"}</span>
        <span class="lastup">${this.formatTime(lastChanged)}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "entities-view": EntitiesView;
  }
}
