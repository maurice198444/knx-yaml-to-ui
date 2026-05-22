import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import "../components/ui/card.js";

@customElement("history-view")
export class HistoryView extends LitElement {
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
      <h1>Migration History</h1>
      <p class="lede">Letzte convert.commit-Operationen dieser Session.</p>
      <knx-card>
        <div class="placeholder">History-Liste — wird in P4 implementiert.</div>
      </knx-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-view": HistoryView;
  }
}
