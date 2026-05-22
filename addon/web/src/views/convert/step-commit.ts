import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../components/ui/btn.js";
import "../../components/ui/pill.js";
import "../../components/ui/icon.js";
import { api, ApiClientError } from "../../api/client.js";
import { store } from "../../state/store.js";
import type { CommitResponse } from "../../api/types.js";

@customElement("step-commit")
export class StepCommit extends LitElement {
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
    .preview {
      background: var(--surface-2);
      border-radius: 10px;
      padding: 18px;
      margin-bottom: 18px;
    }
    .preview ul {
      list-style: none;
      padding: 0;
      margin: 8px 0 0;
    }
    .preview li {
      padding: 6px 0;
      font-family: var(--mono);
      font-size: 13px;
      color: var(--text-secondary);
    }
    .result-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .result-list li {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .result-list li:last-child {
      border-bottom: 0;
    }
    .result-name {
      font-family: var(--mono);
      font-size: 14px;
    }
    .result-id {
      color: var(--text-tertiary);
      font-family: var(--mono);
      font-size: 13px;
      margin-left: auto;
    }
    .err-msg {
      color: var(--err);
      font-size: 13px;
      margin-left: auto;
    }
    .success-banner {
      margin: 0 0 18px;
      padding: 22px 26px;
      background: var(--ok-bg);
      color: var(--ok);
      border-radius: var(--radius);
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .success-banner knx-icon {
      font-size: 28px;
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
  @state() private result: CommitResponse | null = store.state.lastCommit;

  private get okNames(): string[] {
    const dryRun = store.state.dryRunResult;
    return (
      dryRun?.entries.filter((e) => e.validation === "ok").map((e) => e.name) ??
      []
    );
  }

  private async commit(): Promise<void> {
    const path = store.state.selectedFile;
    if (!path) {
      this.error = "Keine Datei gewählt";
      return;
    }
    this.loading = true;
    this.error = null;
    try {
      const res = await api.convert.commit({
        path,
        domain: store.state.selectedDomain,
        only_names: this.okNames,
      });
      this.result = res;
      store.setLastCommit(res);
    } catch (err) {
      this.error =
        err instanceof ApiClientError ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private back(): void {
    store.setStep("dryrun");
  }

  private restart(): void {
    store.resetConvert();
  }

  override render() {
    const path = store.state.selectedFile;
    const domain = store.state.selectedDomain;
    const names = this.okNames;

    if (this.result) {
      const applied = this.result.entries.filter((e) => e.applied);
      const failed = this.result.entries.filter((e) => !e.applied);
      const allOk = failed.length === 0;
      return html`
        <h2>${allOk ? "Commit erfolgreich" : "Commit teilweise"}</h2>
        <p class="meta">
          Migration #${this.result.migration_id} · Datei <code>${path}</code>
        </p>
        <div class="success-banner">
          <knx-icon name="check"></knx-icon>
          <div>
            <strong
              >${applied.length} Entit${applied.length === 1
                ? "y"
                : "ies"}
              angelegt</strong
            >${failed.length > 0
              ? html` · ${failed.length} Fehler`
              : ""}
          </div>
        </div>
        <ul class="result-list">
          ${this.result.entries.map(
            (e) => html`
              <li>
                ${e.applied
                  ? html`<knx-pill kind="ok">ok</knx-pill>`
                  : html`<knx-pill kind="err">error</knx-pill>`}
                <span class="result-name">${e.name}</span>
                ${e.applied
                  ? html`<span class="result-id"
                      >${e.entity_id ?? ""}</span
                    >`
                  : html`<span class="err-msg">${e.error ?? ""}</span>`}
              </li>
            `,
          )}
        </ul>
        <div class="actions">
          <knx-btn variant="ghost" @click=${this.restart}>
            Neuer Convert-Flow
          </knx-btn>
          <div class="right">
            <knx-btn
              variant="primary"
              @click=${() => (window.location.hash = "entities")}
            >
              Zu den Entities
              <knx-icon name="chevron-right"></knx-icon>
            </knx-btn>
          </div>
        </div>
      `;
    }

    return html`
      <h2>Commit bestätigen</h2>
      <p class="meta">
        Datei <code>${path}</code> · Domain <code>${domain}</code> ·
        ${names.length} Entit${names.length === 1 ? "y" : "ies"} werden
        angelegt
      </p>
      <div class="preview">
        <div>Folgende Entities werden in HA registriert:</div>
        <ul>
          ${names.map((n) => html`<li>• ${n}</li>`)}
        </ul>
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : ""}
      <div class="actions">
        <knx-btn variant="ghost" @click=${this.back} ?disabled=${this.loading}>
          <knx-icon name="chevron-left"></knx-icon>Zurück
        </knx-btn>
        <div class="right">
          <knx-btn
            variant="primary"
            ?disabled=${this.loading || names.length === 0}
            @click=${this.commit}
          >
            ${this.loading
              ? "Committe…"
              : `${names.length} Entit${names.length === 1 ? "y" : "ies"} committen`}
          </knx-btn>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "step-commit": StepCommit;
  }
}
