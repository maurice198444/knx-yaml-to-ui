import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import "./icon.js";

export type ModalKind = "neutral" | "danger" | "warn";

@customElement("knx-modal")
export class KnxModal extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(8, 16, 28, 0.55);
      backdrop-filter: blur(2px);
      display: grid;
      place-items: center;
      z-index: 1000;
      animation: fade 0.15s ease-out;
    }
    [data-theme="dark"] .backdrop,
    :host-context([data-theme="dark"]) .backdrop {
      background: rgba(0, 0, 0, 0.65);
    }
    .dialog {
      background: var(--surface);
      border-radius: 14px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
      width: min(440px, 92vw);
      max-height: 84vh;
      overflow: auto;
      animation: pop 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.2);
      border: 1px solid var(--border);
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes pop {
      from {
        opacity: 0;
        transform: scale(0.92) translateY(8px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 22px 24px 12px;
    }
    .icon-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 22px;
      flex-shrink: 0;
    }
    .icon-circle.neutral {
      background: var(--accent-soft);
      color: var(--accent);
    }
    .icon-circle.danger {
      background: var(--err-bg);
      color: var(--err);
    }
    .icon-circle.warn {
      background: var(--warn-bg);
      color: var(--warn);
    }
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
      color: var(--text);
    }
    .body {
      padding: 4px 24px 8px;
      color: var(--text-secondary);
      font-size: 14px;
      line-height: 1.55;
    }
    .body ::slotted(*) {
      margin: 0 0 12px;
    }
    .body ::slotted(:last-child) {
      margin-bottom: 0;
    }
    footer {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 16px 20px 20px;
    }
    button {
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      padding: 9px 18px;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
    }
    .cancel {
      background: transparent;
      color: var(--text-secondary);
      border-color: var(--border);
    }
    .cancel:hover {
      background: var(--surface-2);
      color: var(--text);
    }
    .confirm {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    [data-theme="dark"] .confirm,
    :host-context([data-theme="dark"]) .confirm {
      color: #06121c;
    }
    .confirm:hover {
      background: var(--accent-dark);
    }
    .confirm.danger {
      background: var(--err);
      border-color: var(--err);
      color: #fff;
    }
    .confirm.danger:hover {
      filter: brightness(0.92);
    }
    .confirm.warn {
      background: var(--warn);
      border-color: var(--warn);
      color: #fff;
    }
    button[disabled] {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `;

  @property({ type: Boolean }) open = false;
  @property() kind: ModalKind = "neutral";
  @property() heading = "";
  @property() confirmLabel = "Bestätigen";
  @property() cancelLabel = "Abbrechen";
  @property({ type: Boolean }) busy = false;

  private onKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === "Escape") this.cancel();
    if (e.key === "Enter") this.confirm();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.onKey);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.onKey);
  }

  private cancel(): void {
    if (this.busy) return;
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  private confirm(): void {
    if (this.busy) return;
    this.dispatchEvent(new CustomEvent("confirm", { bubbles: true, composed: true }));
  }

  private iconName(): "alert-circle" | "trash" | "settings" {
    if (this.kind === "danger") return "trash";
    if (this.kind === "warn") return "alert-circle";
    return "settings";
  }

  private onBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) this.cancel();
  };

  override render() {
    if (!this.open) return nothing;
    return html`
      <div class="backdrop" @click=${this.onBackdropClick}>
        <div class="dialog" role="dialog" aria-modal="true" aria-label=${this.heading}>
          <header>
            <div class="icon-circle ${this.kind}">
              <knx-icon .name=${this.iconName()}></knx-icon>
            </div>
            <h2>${this.heading}</h2>
          </header>
          <div class="body">
            <slot></slot>
          </div>
          <footer>
            <button class="cancel" @click=${this.cancel} ?disabled=${this.busy}>
              ${this.cancelLabel}
            </button>
            <button
              class="confirm ${this.kind}"
              @click=${this.confirm}
              ?disabled=${this.busy}
            >
              ${this.busy ? "Bitte warten…" : this.confirmLabel}
            </button>
          </footer>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "knx-modal": KnxModal;
  }
}
