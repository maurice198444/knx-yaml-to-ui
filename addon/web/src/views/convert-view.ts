import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import "../components/ui/card.js";

@customElement("convert-view")
export class ConvertView extends LitElement {
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
      max-width: 560px;
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
      <h1>Convert YAML → UI-Entities</h1>
      <p class="lede">
        Wähle eine Domain (Licht / Sensoren / Rolladen / Heizung), dann eine
        YAML-Datei. Stepper-Flow folgt in Phase 2.
      </p>
      <knx-card>
        <div class="placeholder">Convert-Flow — wird in P2 implementiert.</div>
      </knx-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "convert-view": ConvertView;
  }
}
