import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../components/ui/icon.js";
import { store } from "../../state/store.js";
import type { Domain } from "../../api/types.js";

interface TileSpec {
  id: Domain;
  label: string;
  icon: "lightbulb" | "activity" | "layout" | "thermometer";
  enabled: boolean;
}

const TILES: TileSpec[] = [
  { id: "light", label: "Licht", icon: "lightbulb", enabled: true },
  { id: "sensor", label: "Sensoren", icon: "activity", enabled: false },
  { id: "cover", label: "Rolladen", icon: "layout", enabled: false },
  { id: "climate", label: "Heizung", icon: "thermometer", enabled: false },
];

@customElement("domain-tiles")
export class DomainTiles extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin: 0 0 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 32px;
    }
    @media (max-width: 760px) {
      .grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .tile {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 18px;
      cursor: pointer;
      transition: all 0.18s;
      box-shadow: var(--shadow);
      display: flex;
      align-items: center;
      gap: 14px;
      font: inherit;
      color: inherit;
      text-align: left;
      width: 100%;
    }
    .tile:hover:not([disabled]):not(.active) {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
      border-color: var(--accent);
    }
    .tile.active {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-soft), var(--shadow);
    }
    .tile[disabled] {
      cursor: not-allowed;
      opacity: 0.55;
    }
    .ico {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      font-size: 24px;
    }
    .tile.light .ico {
      background: var(--d-light-bg);
      color: var(--d-light);
    }
    .tile.sensor .ico {
      background: var(--d-sensor-bg);
      color: var(--d-sensor);
    }
    .tile.cover .ico {
      background: var(--d-cover-bg);
      color: var(--d-cover);
    }
    .tile.climate .ico {
      background: var(--d-climate-bg);
      color: var(--d-climate);
    }
    .title {
      font-size: 16px;
      font-weight: 500;
    }
    .status {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 2px;
    }
    .count {
      margin-left: auto;
      font-size: 22px;
      font-weight: 700;
      font-family: var(--mono);
    }
  `;

  @state() private selected: Domain = store.state.selectedDomain;
  @state() private counts: Record<string, number> = {};
  private unsub?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsub = store.subscribe(() => {
      this.selected = store.state.selectedDomain;
      this.counts = this.deriveCounts();
    });
    this.counts = this.deriveCounts();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsub?.();
  }

  private deriveCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of store.state.entities) {
      const prefix = e.entity_id.split(".")[0] ?? "";
      const dom = mapPrefixToDomain(prefix);
      if (dom) counts[dom] = (counts[dom] ?? 0) + 1;
    }
    return counts;
  }

  private select(t: TileSpec): void {
    if (!t.enabled) return;
    store.setDomain(t.id);
  }

  override render() {
    return html`
      <div class="label">KNX Domains</div>
      <div class="grid">
        ${TILES.map(
          (t) => html`
            <button
              class="tile ${t.id} ${this.selected === t.id ? "active" : ""}"
              ?disabled=${!t.enabled}
              title=${t.enabled ? "" : "kommt in Plan-04"}
              @click=${() => this.select(t)}
            >
              <div class="ico">
                <knx-icon name=${t.icon}></knx-icon>
              </div>
              <div>
                <div class="title">${t.label}</div>
                <div class="status">
                  ${t.enabled ? "verfügbar" : "coming soon"}
                </div>
              </div>
              <div class="count">${this.counts[t.id] ?? 0}</div>
            </button>
          `,
        )}
      </div>
    `;
  }
}

function mapPrefixToDomain(prefix: string): Domain | null {
  switch (prefix) {
    case "light":
      return "light";
    case "sensor":
    case "binary_sensor":
      return "sensor";
    case "cover":
      return "cover";
    case "climate":
      return "climate";
    default:
      return null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "domain-tiles": DomainTiles;
  }
}
