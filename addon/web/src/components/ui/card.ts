import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("knx-card")
export class KnxCard extends LitElement {
  static override styles = css`
    :host {
      display: block;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px;
      box-shadow: var(--shadow);
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "knx-card": KnxCard;
  }
}
