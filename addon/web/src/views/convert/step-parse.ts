import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../components/ui/btn.js";
import "../../components/ui/pill.js";
import "../../components/ui/icon.js";
import { api, ApiClientError } from "../../api/client.js";
import { store } from "../../state/store.js";
import type { YamlParseResponse } from "../../api/types.js";

@customElement("step-parse")
export class StepParse extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    h2 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 500;
    }
    p.meta {
      color: var(--text-secondary);
      font-size: 14px;
      margin: 0 0 22px;
    }
    code {
      font-family: var(--mono);
      font-size: 13px;
      background: var(--surface-2);
      padding: 2px 7px;
      border-radius: 5px;
    }
    .domains {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 18px 0;
    }
    .domain-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      background: var(--surface-2);
      border-radius: 10px;
    }
    .domain-name {
      font-family: var(--mono);
      font-weight: 500;
    }
    .domain-count {
      margin-left: auto;
      font-family: var(--mono);
      font-size: 18px;
      font-weight: 700;
    }
    .names {
      color: var(--text-secondary);
      font-size: 13px;
      font-family: var(--mono);
    }
    .actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 24px;
      margin-top: 24px;
      border-top: 1px solid var(--border);
    }
    .actions .right {
      display: flex;
      gap: 8px;
    }
    .loading,
    .error {
      padding: 24px;
      text-align: center;
      color: var(--text-tertiary);
    }
    .error {
      color: var(--err);
    }
  `;

  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private result: YamlParseResponse | null = store.state.parseResult;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.result) void this.load();
  }

  private async load(): Promise<void> {
    const path = store.state.selectedFile;
    if (!path) {
      this.error = "Keine Datei gewählt";
      return;
    }
    this.loading = true;
    this.error = null;
    try {
      const res = await api.yaml.parse(path);
      this.result = res;
    } catch (err) {
      this.error =
        err instanceof ApiClientError ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private back(): void {
    store.setStep("file");
  }

  private next(): void {
    if (this.result) store.setParseResult(this.result);
  }

  private get targetDomainEntries(): number {
    const dom = store.state.selectedDomain;
    return this.result?.domains.find((d) => d.domain === dom)?.entity_count ?? 0;
  }

  override render() {
    const path = store.state.selectedFile;
    const domain = store.state.selectedDomain;
    return html`
      <h2>Datei parsen</h2>
      <p class="meta">
        Datei <code>${path}</code> · Ziel-Domain <code>${domain}</code>
      </p>
      ${this.loading
        ? html`<div class="loading">Parser läuft…</div>`
        : this.error
          ? html`<div class="error">${this.error}</div>`
          : this.result
            ? html`
                <div class="domains">
                  ${this.result.domains.length === 0
                    ? html`<div class="loading">
                        Keine bekannten Domains in Datei gefunden.
                      </div>`
                    : this.result.domains.map(
                        (d) => html`
                          <div class="domain-row">
                            <span class="domain-name">${d.domain}</span>
                            <span class="names" title=${d.entity_names.join(", ")}>
                              ${d.entity_names.slice(0, 4).join(", ")}${d.entity_names.length > 4 ? "…" : ""}
                            </span>
                            <span class="domain-count">${d.entity_count}</span>
                          </div>
                        `,
                      )}
                </div>
                <p class="meta">
                  Rohgröße: ${this.result.raw_size} Bytes ·
                  ${this.targetDomainEntries} Entitäten in
                  <code>${domain}</code>
                </p>
              `
            : ""}
      <div class="actions">
        <knx-btn variant="ghost" @click=${this.back}>
          <knx-icon name="chevron-left"></knx-icon>Zurück
        </knx-btn>
        <div class="right">
          <knx-btn
            variant="primary"
            ?disabled=${!this.result || this.targetDomainEntries === 0}
            @click=${this.next}
          >
            Testlauf starten
            <knx-icon name="chevron-right"></knx-icon>
          </knx-btn>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "step-parse": StepParse;
  }
}
