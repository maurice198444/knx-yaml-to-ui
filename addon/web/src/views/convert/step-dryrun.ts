import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../components/ui/btn.js";
import "../../components/ui/pill.js";
import "../../components/ui/icon.js";
import { api, ApiClientError } from "../../api/client.js";
import { store } from "../../state/store.js";
import type { DryRunResponse } from "../../api/types.js";

@customElement("step-dryrun")
export class StepDryRun extends LitElement {
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
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      padding: 0 14px 12px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid var(--border);
    }
    td {
      padding: 14px;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
      vertical-align: top;
    }
    tbody tr:last-child td {
      border-bottom: 0;
    }
    tbody tr:hover {
      background: var(--surface-2);
    }
    .err-msg {
      color: var(--err);
      font-size: 13px;
      font-family: var(--mono);
    }
    .payload-toggle {
      background: none;
      border: 0;
      color: var(--accent);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      padding: 0;
    }
    .payload-toggle:hover {
      text-decoration: underline;
    }
    pre.payload {
      margin: 8px 0 0;
      padding: 10px 12px;
      background: var(--bg);
      border-radius: 6px;
      font-family: var(--mono);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--text-secondary);
    }
    .summary {
      margin: 26px 0 6px;
      padding: 22px 26px;
      background: var(--accent);
      border-radius: var(--radius);
      color: #fff;
      display: flex;
      align-items: center;
      gap: 24px;
      box-shadow: 0 4px 16px var(--accent-soft);
    }
    [data-theme="dark"] .summary,
    :host-context([data-theme="dark"]) .summary {
      color: #06121c;
    }
    .summary .num {
      font-size: 52px;
      font-weight: 700;
      line-height: 1;
      font-family: var(--mono);
    }
    .summary h3 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 500;
    }
    .summary p {
      margin: 0;
      font-size: 14px;
      opacity: 0.92;
      max-width: 460px;
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
  @state() private result: DryRunResponse | null = store.state.dryRunResult;
  @state() private expanded = new Set<string>();

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
      const res = await api.convert.dryRun({
        path,
        domain: store.state.selectedDomain,
      });
      this.result = res;
    } catch (err) {
      this.error =
        err instanceof ApiClientError ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private togglePayload(name: string): void {
    const next = new Set(this.expanded);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    this.expanded = next;
  }

  private back(): void {
    store.setStep("parse");
  }

  private next(): void {
    if (this.result) store.setDryRunResult(this.result);
  }

  private get okCount(): number {
    return this.result?.entries.filter((e) => e.validation === "ok").length ?? 0;
  }

  override render() {
    const path = store.state.selectedFile;
    const domain = store.state.selectedDomain;
    const entries = this.result?.entries ?? [];
    return html`
      <h2>Testlauf-Ergebnis prüfen</h2>
      <p class="meta">
        Datei <code>${path}</code> · Bereich <code>${domain}</code> ·
        ${entries.length} Entitäten erkannt
      </p>
      ${this.loading
        ? html`<div class="loading">Testlauf läuft…</div>`
        : this.error
          ? html`<div class="error">${this.error}</div>`
          : entries.length === 0
            ? html`<div class="loading">
                Keine Entitäten im Testlauf-Ergebnis.
              </div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th style="width:42%">Name</th>
                      <th style="width:18%">Status</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${entries.map(
                      (e) => html`
                        <tr>
                          <td>${e.name}</td>
                          <td>
                            ${e.validation === "ok"
                              ? html`<knx-pill kind="ok">ok</knx-pill>`
                              : html`<knx-pill kind="err">error</knx-pill>`}
                          </td>
                          <td>
                            ${e.validation === "ok"
                              ? html`
                                  <button
                                    class="payload-toggle"
                                    @click=${() => this.togglePayload(e.name)}
                                  >
                                    ${this.expanded.has(e.name)
                                      ? "Daten verbergen"
                                      : "Daten anzeigen →"}
                                  </button>
                                  ${this.expanded.has(e.name)
                                    ? html`<pre class="payload">
${JSON.stringify(e.payload, null, 2)}</pre
                                      >`
                                    : ""}
                                `
                              : html`<span class="err-msg"
                                  >${e.message ?? "unbekannter Fehler"}</span
                                >`}
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
                ${this.okCount > 0
                  ? html`
                      <div class="summary">
                        <div class="num">${this.okCount}</div>
                        <div>
                          <h3>Bereit zur Übernahme</h3>
                          <p>
                            ${this.okCount} Entität${this.okCount === 1
                              ? " wird"
                              : "en werden"}
                            als UI-Config-Store-Eintr${this.okCount === 1
                              ? "ag"
                              : "äge"}
                            angelegt.
                          </p>
                        </div>
                      </div>
                    `
                  : ""}
              `}
      <div class="actions">
        <knx-btn variant="ghost" @click=${this.back}>
          <knx-icon name="chevron-left"></knx-icon>Zurück
        </knx-btn>
        <div class="right">
          <knx-btn
            variant="primary"
            ?disabled=${this.okCount === 0}
            @click=${this.next}
          >
            ${this.okCount} Entität${this.okCount === 1 ? "" : "en"}
            übernehmen
            <knx-icon name="chevron-right"></knx-icon>
          </knx-btn>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "step-dryrun": StepDryRun;
  }
}
