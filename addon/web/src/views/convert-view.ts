import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../components/ui/card.js";
import "./convert/domain-tiles.js";
import "./convert/stepper.js";
import "./convert/step-file.js";
import "./convert/step-parse.js";
import "./convert/step-dryrun.js";
import "./convert/step-commit.js";
import { api, ApiClientError } from "../api/client.js";
import { store } from "../state/store.js";
import type { ConvertStep } from "../state/store.js";

@customElement("convert-view")
export class ConvertView extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @state() private step: ConvertStep = store.state.currentStep;
  private unsub?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsub = store.subscribe(() => {
      this.step = store.state.currentStep;
    });
    void this.refreshEntities();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsub?.();
  }

  private async refreshEntities(): Promise<void> {
    try {
      const res = await api.entities.list();
      store.setEntities(res.entities);
    } catch (err) {
      if (!(err instanceof ApiClientError)) throw err;
      // Counts default to 0 — tile UX still works.
    }
  }

  private renderStep() {
    switch (this.step) {
      case "file":
        return html`<step-file></step-file>`;
      case "parse":
        return html`<step-parse></step-parse>`;
      case "dryrun":
        return html`<step-dryrun></step-dryrun>`;
      case "commit":
        return html`<step-commit></step-commit>`;
    }
  }

  override render() {
    return html`
      <domain-tiles></domain-tiles>
      <convert-stepper></convert-stepper>
      <knx-card>${this.renderStep()}</knx-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "convert-view": ConvertView;
  }
}
