import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../components/ui/card.js";
import "../components/ui/btn.js";
import "../components/ui/pill.js";
import "../components/ui/icon.js";
import "../components/ui/live-dot.js";
import { api, ApiClientError } from "../api/client.js";
import { ws } from "../api/ws.js";
import type { StateEvent } from "../api/ws.js";
import type { EntitySummary } from "../api/types.js";
import type { LiveStatus } from "../components/ui/live-dot.js";

interface LiveSnapshot {
  state: string | null;
  lastChanged: string | null;
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
    .state {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 11px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      background: var(--surface-2);
      color: var(--text-secondary);
      font-family: var(--mono);
    }
    .state .sdot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-tertiary);
    }
    .state.on {
      background: var(--ok-bg);
      color: var(--ok);
    }
    .state.on .sdot {
      background: var(--ok);
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
  `;

  @state() private entities: EntitySummary[] = [];
  @state() private liveStates = new Map<string, LiveSnapshot>();
  @state() private recentlyUpdated = new Set<string>();
  @state() private selected = new Set<string>();
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private deleting = false;
  @state() private wsStatus: LiveStatus = ws.status;

  private flashTimers = new Map<string, number>();
  private onWsState = (e: Event) => {
    const detail = (e as CustomEvent<StateEvent>).detail;
    if (!detail.entity_id) return;
    const next = new Map(this.liveStates);
    next.set(detail.entity_id, {
      state: detail.state,
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

  private async deleteSelected(): Promise<void> {
    if (this.selected.size === 0 || this.deleting) return;
    const ids = [...this.selected];
    const confirmMsg =
      ids.length === 1
        ? `Entity ${ids[0]} wirklich löschen?`
        : `${ids.length} Entities wirklich löschen?`;
    if (!window.confirm(confirmMsg)) return;
    this.deleting = true;
    this.error = null;
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
    if (v === "on") return "state on";
    if (v === "off" || v === "unavailable" || v === "unknown") return "state";
    return "state";
  }

  override render() {
    const total = this.entities.length;
    const selectedCount = this.selected.size;
    const allSelected = total > 0 && selectedCount === total;
    return html`
      <h1>KNX Entities</h1>
      <p class="lede">Liste aller KNX-Entities mit Live-State via WebSocket.</p>
      <knx-card>
        <div class="card-head">
          <h2>KNX Entities</h2>
          <knx-live-dot class="count" .status=${this.wsStatus}>
            ${this.wsStatus === "open"
              ? html`live · ${total} entities`
              : this.wsStatus === "connecting"
                ? html`verbinde…`
                : html`offline · ${total} entities`}
          </knx-live-dot>
        </div>
        ${this.error ? html`<div class="error">${this.error}</div>` : nothing}
        ${this.loading
          ? html`<div class="loading">Lade Entities…</div>`
          : total === 0
            ? html`<div class="empty">
                Keine KNX-Entities gefunden. Lege welche im Convert-Tab an.
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
                      <th>Entity ID</th>
                      <th>State</th>
                      <th>Source</th>
                      <th>Last update</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.entities.map((e) => {
                      const live = this.liveStates.get(e.entity_id);
                      const stateValue = live?.state ?? e.state ?? null;
                      const lastChanged = live?.lastChanged ?? null;
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
                          <td class="mono">${e.entity_id}</td>
                          <td>
                            <span class=${this.stateClass(stateValue)}>
                              <span class="sdot"></span>${stateValue ?? "—"}
                            </span>
                          </td>
                          <td>
                            <knx-pill kind="ok">${e.platform || "knx"}</knx-pill>
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
            <knx-icon name="refresh"></knx-icon>Refresh
          </knx-btn>
          <knx-btn
            class="del"
            variant="danger"
            ?disabled=${selectedCount === 0 || this.deleting}
            @click=${this.deleteSelected}
          >
            <knx-icon name="trash"></knx-icon>
            ${this.deleting
              ? "Lösche…"
              : selectedCount === 0
                ? "Markierte löschen"
                : `${selectedCount} löschen`}
          </knx-btn>
        </div>
      </knx-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "entities-view": EntitiesView;
  }
}
