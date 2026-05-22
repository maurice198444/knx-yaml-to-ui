import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

export type TabItem = { id: string; label: string };

@customElement("knx-tabs")
export class KnxTabs extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      gap: 4px;
    }
    button {
      font-family: inherit;
      font-size: 15px;
      font-weight: 500;
      border: 0;
      background: none;
      color: var(--text-secondary);
      padding: 8px 18px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
    }
    button:hover {
      background: var(--surface-2);
      color: var(--text);
    }
    button.active {
      background: var(--accent);
      color: #fff;
    }
    :host([variant="soft"]) button.active {
      background: var(--accent-soft);
      color: var(--accent);
      box-shadow: inset 0 0 0 1px var(--accent-line);
    }
  `;

  @property({ attribute: false }) items: TabItem[] = [];
  @property() active = "";
  @property() variant: "solid" | "soft" = "solid";

  private select(id: string) {
    this.dispatchEvent(new CustomEvent("change", { detail: id, bubbles: true, composed: true }));
  }

  override render() {
    return html`
      ${this.items.map(
        (it) =>
          html`<button
            class=${this.active === it.id ? "active" : ""}
            @click=${() => this.select(it.id)}
          >
            ${it.label}
          </button>`,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "knx-tabs": KnxTabs;
  }
}
