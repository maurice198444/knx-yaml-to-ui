import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

export type PillKind = "ok" | "err" | "warn" | "neutral";

@customElement("knx-pill")
export class KnxPill extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 11px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .ok {
      background: var(--ok-bg);
      color: var(--ok);
    }
    .ok .dot {
      background: var(--ok);
    }
    .err {
      background: var(--err-bg);
      color: var(--err);
    }
    .err .dot {
      background: var(--err);
    }
    .warn {
      background: var(--warn-bg);
      color: var(--warn);
    }
    .warn .dot {
      background: var(--warn);
    }
    .neutral {
      background: var(--surface-2);
      color: var(--text-secondary);
    }
    .neutral .dot {
      background: var(--text-tertiary);
    }
  `;

  @property() kind: PillKind = "neutral";
  @property({ type: Boolean }) showDot = true;

  override render() {
    return html`
      <span class="pill ${this.kind}">
        ${this.showDot ? html`<span class="dot"></span>` : ""}
        <slot></slot>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "knx-pill": KnxPill;
  }
}
