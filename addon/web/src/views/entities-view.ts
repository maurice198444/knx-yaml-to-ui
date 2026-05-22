import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import "../components/ui/card.js";

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
    .placeholder {
      padding: 40px;
      text-align: center;
      color: var(--text-tertiary);
      font-style: italic;
    }
  `;

  override render() {
    return html`
      <h1>KNX Entities</h1>
      <p class="lede">Liste aller KNX-Entities mit Live-State via WebSocket.</p>
      <knx-card>
        <div class="placeholder">Entity-Liste + WS — wird in P3 implementiert.</div>
      </knx-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "entities-view": EntitiesView;
  }
}
