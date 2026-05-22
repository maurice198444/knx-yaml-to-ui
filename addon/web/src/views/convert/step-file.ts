import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../components/ui/btn.js";
import "../../components/ui/icon.js";
import { api, ApiClientError } from "../../api/client.js";
import { store } from "../../state/store.js";
import type { YamlFile } from "../../api/types.js";

@customElement("step-file")
export class StepFile extends LitElement {
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
    ul.files {
      list-style: none;
      padding: 0;
      margin: 0 0 8px;
      border-top: 1px solid var(--border);
    }
    li.file {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 4px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: background 0.12s;
    }
    li.file:hover {
      background: var(--surface-2);
    }
    li.file knx-icon {
      font-size: 20px;
      color: var(--text-tertiary);
    }
    .name {
      font-family: var(--mono);
      font-size: 14px;
    }
    .size {
      margin-left: auto;
      color: var(--text-tertiary);
      font-size: 13px;
      font-family: var(--mono);
    }
    .empty,
    .loading,
    .error {
      padding: 28px;
      text-align: center;
      color: var(--text-tertiary);
    }
    .error {
      color: var(--err);
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 18px;
    }
  `;

  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private files: YamlFile[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const res = await api.yaml.list();
      this.files = res.files;
      store.setFiles(res.files);
    } catch (err) {
      this.error =
        err instanceof ApiClientError ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private pick(name: string): void {
    store.selectFile(name);
  }

  override render() {
    return html`
      <h2>YAML-Datei wählen</h2>
      <p class="meta">
        Dateien aus <code>/config/knx/</code>. Klick wählt aus und geht zum
        nächsten Schritt.
      </p>
      ${this.loading
        ? html`<div class="loading">Lade Dateien…</div>`
        : this.error
          ? html`<div class="error">${this.error}</div>`
          : this.files.length === 0
            ? html`<div class="empty">
                Keine YAML-Dateien in /config/knx/ gefunden.
              </div>`
            : html`
                <ul class="files">
                  ${this.files.map(
                    (f) => html`
                      <li class="file" @click=${() => this.pick(f.name)}>
                        <knx-icon name="file"></knx-icon>
                        <span class="name">${f.name}</span>
                        <span class="size">${formatSize(f.size_bytes)}</span>
                      </li>
                    `,
                  )}
                </ul>
              `}
      <div class="actions">
        <knx-btn variant="ghost" @click=${() => this.load()}>
          <knx-icon name="refresh"></knx-icon>Neu laden
        </knx-btn>
      </div>
    `;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

declare global {
  interface HTMLElementTagNameMap {
    "step-file": StepFile;
  }
}
