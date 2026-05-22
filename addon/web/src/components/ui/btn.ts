import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

export type BtnVariant = "primary" | "ghost" | "text" | "danger";

@customElement("knx-btn")
export class KnxBtn extends LitElement {
  static override styles = css`
    :host {
      display: inline-block;
    }
    button {
      font-family: inherit;
      font-size: 15px;
      font-weight: 500;
      padding: 11px 22px;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    button[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .primary {
      background: var(--accent);
      color: #fff;
    }
    [data-theme="dark"] .primary,
    :host-context([data-theme="dark"]) .primary {
      color: #06121c;
    }
    .primary:hover:not([disabled]) {
      background: var(--accent-dark);
      box-shadow: 0 4px 12px var(--accent-soft);
    }
    .ghost {
      background: transparent;
      color: var(--text-secondary);
      border-color: var(--border);
    }
    .ghost:hover:not([disabled]) {
      color: var(--text);
      background: var(--surface-2);
    }
    .text {
      background: transparent;
      color: var(--text-secondary);
    }
    .text:hover:not([disabled]) {
      color: var(--text);
    }
    .danger {
      background: transparent;
      color: var(--err);
    }
    .danger:hover:not([disabled]) {
      background: var(--err-bg);
    }
  `;

  @property() variant: BtnVariant = "primary";
  @property({ type: Boolean }) disabled = false;

  override render() {
    return html`
      <button class=${this.variant} ?disabled=${this.disabled}>
        <slot></slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "knx-btn": KnxBtn;
  }
}
