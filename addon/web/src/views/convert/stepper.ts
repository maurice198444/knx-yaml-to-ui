import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../components/ui/icon.js";
import { store } from "../../state/store.js";
import type { ConvertStep } from "../../state/store.js";

const ORDER: ConvertStep[] = ["file", "parse", "dryrun", "commit"];
const LABELS: Record<ConvertStep, string> = {
  file: "Datei",
  parse: "Parsen",
  dryrun: "Testlauf",
  commit: "Übernehmen",
};

@customElement("convert-stepper")
export class ConvertStepper extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .stepper {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      position: relative;
      margin-bottom: 36px;
      padding-top: 6px;
    }
    .stepper::before {
      content: "";
      position: absolute;
      top: 26px;
      left: 12.5%;
      right: 12.5%;
      height: 2px;
      background: var(--border);
    }
    .stepper::after {
      content: "";
      position: absolute;
      top: 26px;
      left: 12.5%;
      width: calc((var(--progress, 1) - 1) / 3 * 75%);
      height: 2px;
      background: var(--accent);
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .step {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      background: none;
      border: 0;
      font: inherit;
      color: inherit;
    }
    .step[disabled] {
      cursor: not-allowed;
    }
    .circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--surface);
      border: 2px solid var(--border);
      color: var(--text-tertiary);
      display: grid;
      place-items: center;
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 10px;
      transition: all 0.3s;
    }
    .circle knx-icon {
      font-size: 16px;
    }
    .step.done .circle {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    [data-theme="dark"] .step.done .circle,
    :host-context([data-theme="dark"]) .step.done .circle {
      color: #06121c;
    }
    .step.active .circle {
      background: var(--surface);
      border-color: var(--accent);
      color: var(--accent);
      animation: glow 2.2s ease-in-out infinite;
    }
    @keyframes glow {
      0%,
      100% {
        box-shadow: 0 0 0 0 var(--accent-soft);
      }
      50% {
        box-shadow: 0 0 0 8px transparent, 0 0 16px 2px var(--accent-line);
      }
    }
    .step .lbl {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-tertiary);
    }
    .step.done .lbl,
    .step.active .lbl {
      color: var(--text);
    }
    .step.active .lbl {
      color: var(--accent);
    }
  `;

  @state() private current: ConvertStep = store.state.currentStep;
  private unsub?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsub = store.subscribe(() => {
      this.current = store.state.currentStep;
    });
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsub?.();
  }

  private go(step: ConvertStep, idx: number): void {
    const currentIdx = ORDER.indexOf(this.current);
    if (idx <= currentIdx) store.setStep(step);
  }

  private classFor(idx: number): string {
    const currentIdx = ORDER.indexOf(this.current);
    if (idx < currentIdx) return "step done";
    if (idx === currentIdx) return "step active";
    return "step";
  }

  override render() {
    const progress = ORDER.indexOf(this.current) + 1;
    return html`
      <div class="stepper" style="--progress: ${progress};">
        ${ORDER.map((step, i) => {
          const cls = this.classFor(i);
          const isDone = cls.includes("done");
          const currentIdx = ORDER.indexOf(this.current);
          return html`
            <button
              class=${cls}
              ?disabled=${i > currentIdx}
              @click=${() => this.go(step, i)}
            >
              <div class="circle">
                ${isDone
                  ? html`<knx-icon name="check"></knx-icon>`
                  : html`${i + 1}`}
              </div>
              <div class="lbl">${LABELS[step]}</div>
            </button>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "convert-stepper": ConvertStepper;
  }
}
