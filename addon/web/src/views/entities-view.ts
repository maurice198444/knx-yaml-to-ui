import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../components/ui/card.js";
import "../components/ui/btn.js";
import "../components/ui/pill.js";
import "../components/ui/icon.js";
import type { IconName } from "../components/ui/icon.js";
import "../components/ui/modal.js";
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

const STATE_LABELS: Record<string, string> = {
  on: "an",
  off: "aus",
  unknown: "unbekannt",
  unavailable: "nicht verfügbar",
  idle: "inaktiv",
  active: "aktiv",
  // climate
  heat: "heizen",
  cool: "kühlen",
  heat_cool: "heizen/kühlen",
  auto: "automatisch",
  fan_only: "nur lüfter",
  dry: "entfeuchten",
  heating: "heizt",
  cooling: "kühlt",
  // cover
  open: "offen",
  closed: "geschlossen",
  opening: "öffnet",
  closing: "schließt",
  // presence / binary
  home: "zuhause",
  not_home: "abwesend",
  detected: "erkannt",
  not_detected: "nicht erkannt",
  locked: "gesperrt",
  unlocked: "entsperrt",
  // generic
  none: "—",
};

function translateState(value: string | null): string {
  if (value === null) return "—";
  return STATE_LABELS[value.toLowerCase()] ?? value;
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
      margin: 0 0 24px;
    }
    .card-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .card-head h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }
    .card-head .count {
      margin-left: auto;
      font-size: 13px;
      color: var(--text-secondary);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      padding: 0 14px 12px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid var(--border);
    }
    td {
      padding: 14px;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
      vertical-align: middle;
    }
    tbody tr:last-child td {
      border-bottom: 0;
    }
    tbody tr:hover {
      background: var(--surface-2);
    }
    .mono {
      font-family: var(--mono);
      font-size: 13px;
    }
    .check-col {
      width: 38px;
    }
    .id-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .id-icon {
      width: 26px;
      height: 26px;
      border-radius: 7px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      font-size: 15px;
    }
    .id-icon.light {
      background: var(--d-light-bg);
      color: var(--d-light);
    }
    .id-icon.sensor {
      background: var(--d-sensor-bg);
      color: var(--d-sensor);
    }
    .id-icon.cover {
      background: var(--d-cover-bg);
      color: var(--d-cover);
    }
    .id-icon.climate {
      background: var(--d-climate-bg);
      color: var(--d-climate);
    }
    .id-icon.neutral {
      background: var(--surface-2);
      color: var(--text-secondary);
    }
    .state {
      display: inline-flex;
      align-items: center;
      padding: 4px 11px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      background: var(--surface-2);
      color: var(--text-secondary);
      font-family: var(--mono);
    }
    .state.on {
      background: var(--ok-bg);
      color: var(--ok);
    }
    .state.warn {
      background: var(--warn-bg);
      color: var(--warn);
    }
    .state .unit {
      opacity: 0.75;
      margin-left: 3px;
    }
    .state.unknown {
      opacity: 0.7;
    }
    tr.updated td {
      animation: flash 1.2s ease-out;
    }
    @keyframes flash {
      0% {
        background: var(--accent-soft);
      }
      100% {
        background: transparent;
      }
    }
    .card-foot {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 18px;
      margin-top: 18px;
      border-top: 1px solid var(--border);
    }
    .card-foot .del {
      margin-left: auto;
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
    .modal-list {
      list-style: none;
      padding: 10px 14px;
      margin: 6px 0;
      background: var(--surface-2);
      border-radius: 8px;
      max-height: 180px;
      overflow: auto;
    }
    .modal-list li {
      font-family: var(--mono);
      font-size: 13px;
      padding: 3px 0;
      color: var(--text-secondary);
    }
    .modal-warn {
      color: var(--err);
      font-size: 13px;
    }
  `;

  @state() private entities: EntitySummary[] = [];
  @state() private liveStates = new Map<string, LiveSnapshot>();
  @state() private recentlyUpdated = new Set<string>();
  @state() private selected = new Set<string>();
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private deleting = false;
  @state() private deleteModalOpen = false;
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
      const stillValid = new Set(res.entities.map((e) => e.entity_id));
      const trimmedSel = new Set<string>();
      for (const id of this.selected) if (stillValid.has(id)) trimmedSel.add(id);
      this.selected = trimmedSel;
    } catch (err) {
      this.error = err instanceof ApiClientError ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private toggleSelect(id: string, checked: boolean): void {
    const next = new Set(this.selected);
    if (checked) next.add(id);
    else next.delete(id);
    this.selected = next;
  }

  private toggleSelectAll(checked: boolean): void {
    if (checked) this.selected = new Set(this.entities.map((e) => e.entity_id));
    else this.selected = new Set();
  }

  private openDeleteModal(): void {
    if (this.selected.size === 0) return;
    this.deleteModalOpen = true;
  }

  private closeDeleteModal(): void {
    if (this.deleting) return;
    this.deleteModalOpen = false;
  }

  private async confirmDelete(): Promise<void> {
    if (this.deleting) return;
    this.deleting = true;
    this.error = null;
    const ids = [...this.selected];
    const errors: string[] = [];
    for (const id of ids) {
      try {
        await api.entities.delete(id);
      } catch (err) {
        errors.push(
          `${id}: ${err instanceof ApiClientError ? err.message : String(err)}`,
        );
      }
    }
    this.deleting = false;
    this.deleteModalOpen = false;
    if (errors.length > 0) this.error = errors.join(" · ");
    await this.refresh();
  }

  private formatTime(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour12: false });
  }

  private stateClass(value: string | null): string {
    if (!value) return "state unknown";
    const v = value.toLowerCase();
    if (v === "on" || v === "open" || v === "home" || v === "detected" || v === "unlocked")
      return "state on";
    if (
      v === "heat" ||
      v === "cool" ||
      v === "heating" ||
      v === "cooling" ||
      v === "opening" ||
      v === "closing"
    )
      return "state warn";
    if (v === "unknown" || v === "unavailable") return "state unknown";
    return "state";
  }

  private iconForEntity(entityId: string): { icon: IconName; kind: string } {
    const prefix = entityId.split(".", 1)[0] ?? "";
    switch (prefix) {
      case "light":
        return { icon: "lightbulb", kind: "light" };
      case "switch":
        return { icon: "power", kind: "light" };
      case "sensor":
        return { icon: "activity", kind: "sensor" };
      case "binary_sensor":
        return { icon: "alert-circle", kind: "sensor" };
      case "cover":
        return { icon: "layout", kind: "cover" };
      case "climate":
        return { icon: "thermometer", kind: "climate" };
      case "time":
      case "datetime":
        return { icon: "clock", kind: "neutral" };
      default:
        return { icon: "file", kind: "neutral" };
    }
  }

  private renderStateValue(value: string | null, unit: string | null) {
    if (value === null) return html`—`;
    const isNumeric = unit !== null && !Number.isNaN(Number(value));
    const display = isNumeric ? value : translateState(value);
    if (unit) return html`${display}<span class="unit">${unit}</span>`;
    return html`${display}`;
  }

  override render() {
    const total = this.entities.length;
    const selectedCount = this.selected.size;
    const allSelected = total > 0 && selectedCount === total;
    return html`
      <h1>KNX-Entitäten</h1>
      <p class="lede">Liste aller KNX-Entitäten mit Live-Status über WebSocket.</p>
      <knx-card>
        <div class="card-head">
          <h2>KNX-Entitäten</h2>
          <span class="count">
            ${this.wsStatus === "open"
              ? html`Live · ${total} Entitäten`
              : this.wsStatus === "connecting"
                ? html`Verbinde…`
                : html`Offline · ${total} Entitäten`}
          </span>
        </div>
        ${this.error ? html`<div class="error">${this.error}</div>` : nothing}
        ${this.loading
          ? html`<div class="loading">Lade Entitäten…</div>`
          : total === 0
            ? html`<div class="empty">
                Keine KNX-Entitäten gefunden. Lege welche im Konvertieren-Tab an.
              </div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th class="check-col">
                        <input
                          type="checkbox"
                          .checked=${allSelected}
                          @change=${(e: Event) =>
                            this.toggleSelectAll(
                              (e.target as HTMLInputElement).checked,
                            )}
                        />
                      </th>
                      <th>Entitäts-ID</th>
                      <th>Status</th>
                      <th>Quelle</th>
                      <th>Letzte Aktualisierung</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.entities.map((e) => {
                      const live = this.liveStates.get(e.entity_id);
                      const stateValue = live?.state ?? e.state ?? null;
                      const unit = live?.unit ?? e.unit_of_measurement ?? null;
                      const lastChanged =
                        live?.lastChanged ?? e.last_changed ?? null;
                      const rowClass = this.recentlyUpdated.has(e.entity_id)
                        ? "updated"
                        : "";
                      return html`
                        <tr class=${rowClass}>
                          <td>
                            <input
                              type="checkbox"
                              .checked=${this.selected.has(e.entity_id)}
                              @change=${(ev: Event) =>
                                this.toggleSelect(
                                  e.entity_id,
                                  (ev.target as HTMLInputElement).checked,
                                )}
                            />
                          </td>
                          <td>
                            <div class="id-cell">
                              ${(() => {
                                const ic = this.iconForEntity(e.entity_id);
                                return html`<span class="id-icon ${ic.kind}"
                                  ><knx-icon .name=${ic.icon}></knx-icon
                                ></span>`;
                              })()}
                              <span class="mono">${e.entity_id}</span>
                            </div>
                          </td>
                          <td>
                            <span class=${this.stateClass(stateValue)}>
                              ${this.renderStateValue(stateValue, unit)}
                            </span>
                          </td>
                          <td>
                            <knx-pill kind="ok" .showDot=${false}>
                              ${e.platform || "knx"}
                            </knx-pill>
                          </td>
                          <td class="mono">${this.formatTime(lastChanged)}</td>
                        </tr>
                      `;
                    })}
                  </tbody>
                </table>
              `}
        <div class="card-foot">
          <knx-btn variant="ghost" @click=${this.refresh} ?disabled=${this.loading}>
            <knx-icon name="refresh"></knx-icon>Aktualisieren
          </knx-btn>
          <knx-btn
            class="del"
            variant="danger"
            ?disabled=${selectedCount === 0 || this.deleting}
            @click=${this.openDeleteModal}
          >
            <knx-icon name="trash"></knx-icon>
            ${selectedCount === 0
              ? "Markierte löschen"
              : `${selectedCount} löschen`}
          </knx-btn>
        </div>
      </knx-card>

      <knx-modal
        ?open=${this.deleteModalOpen}
        kind="danger"
        .heading=${this.selected.size === 1
          ? "Entität löschen?"
          : `${this.selected.size} Entitäten löschen?`}
        confirmLabel=${this.selected.size === 1 ? "Löschen" : "Alle löschen"}
        cancelLabel="Abbrechen"
        ?busy=${this.deleting}
        @cancel=${this.closeDeleteModal}
        @confirm=${this.confirmDelete}
      >
        <p>
          Folgende
          ${this.selected.size === 1 ? "Entität wird" : "Entitäten werden"}
          aus der KNX-Integration entfernt:
        </p>
        <ul class="modal-list">
          ${[...this.selected].map((id) => html`<li>${id}</li>`)}
        </ul>
        <p class="modal-warn">Diese Aktion kann nicht rückgängig gemacht werden.</p>
      </knx-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "entities-view": EntitiesView;
  }
}
