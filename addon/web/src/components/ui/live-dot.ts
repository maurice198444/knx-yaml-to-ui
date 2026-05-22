import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

export type LiveStatus = "open" | "connecting" | "closed";

@customElement("knx-live-dot")
export class KnxLiveDot extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .open {
      background: var(--ok);
      animation: pulse 2.4s infinite;
    }
    .connecting {
      background: var(--warn);
      animation: pulse 1.2s infinite;
    }
    .closed {
      background: var(--text-tertiary);
    }
    @keyframes pulse {
      0%,
      100% {
        box-shadow: 0 0 0 0 rgba(34, 164, 93, 0.5);
      }
      50% {
        box-shadow: 0 0 0 5px rgba(34, 164, 93, 0);
      }
    }
  `;

  @property() status: LiveStatus = "closed";

  override render() {
    return html`
      <span class="dot ${this.status}"></span>
      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "knx-live-dot": KnxLiveDot;
  }
}
