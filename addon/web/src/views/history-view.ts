import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../components/ui/card.js";
import "../components/ui/pill.js";
import "../components/ui/icon.js";
import { store } from "../state/store.js";
import type { CommitResponse } from "../api/types.js";

const DOMAIN_LABEL: Record<string, string> = {
  light: "Licht",
  sensor: "Sensor",
  cover: "Rolladen",
  climate: "Heizung",
};

type Kind = "ok" | "warn" | "err";
type Summary = { kind: Kind; label: string };

function summarize(commit: CommitResponse): Summary {
  const total = commit.entries.length;
  const ok = commit.entries.filter((e) => e.applied).length;
  if (ok === 0) return { kind: "err", label: "Fehler" };
  if (ok < total) return { kind: "warn", label: "Teilweise" };
  return { kind: "ok", label: "Erfolgreich" };
}

function formatTime(ts: number): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}

@customElement("history-view")
export class HistoryView extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 26px;
      font-weight: 500;
    }
    p.lede {
      color: var(--text-secondary);
      margin: 0 0 24px;
    }
    .toolbar {
      display: flex;
      gap: 12px;
      margin-bottom: 18px;
      align-items: center;
    }
    .toolbar label {
      font-size: 13px;
      color: var(--text-tertiary);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    select {
      font: inherit;
      font-size: 13px;
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      cursor: not-allowed;
    }
    select[disabled] {
      opacity: 0.65;
    }
    .empty {
      padding: 56px 24px;
      text-align: center;
      color: var(--text-tertiary);
    }
    .empty knx-icon {
      font-size: 36px;
      display: inline-block;
      margin-bottom: 12px;
      opacity: 0.6;
    }
    .empty p {
      margin: 0 0 4px;
      font-size: 15px;
    }
    .empty .small {
      font-size: 13px;
      opacity: 0.8;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    thead th {
      text-align: left;
      padding: 0 14px 12px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid var(--border);
    }
    tbody tr.row {
      cursor: pointer;
      transition: background 0.12s;
    }
    tbody tr.row:hover {
      background: var(--surface-2);
    }
    tbody tr.row td {
      padding: 14px;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
      vertical-align: middle;
    }
    tbody tr.row td.num {
      font-family: var(--mono);
      color: var(--text-tertiary);
      width: 64px;
    }
    tbody tr.row td.time {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--text-secondary);
      width: 110px;
    }
    tbody tr.row td.domain {
      width: 120px;
    }
    tbody tr.row td.status {
      width: 130px;
    }
    tbody tr.row td.entries {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--text-secondary);
    }
    tbody tr.row td.caret {
      width: 32px;
      text-align: right;
      color: var(--text-tertiary);
    }
    tbody tr.row td.caret knx-icon {
      transition: transform 0.18s;
      font-size: 16px;
    }
    tbody tr.row.open td.caret knx-icon {
      transform: rotate(90deg);
    }
    tbody tr.detail td {
      padding: 0 14px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-2);
    }
    .detail-inner {
      padding: 14px 16px;
      border-radius: 8px;
      background: var(--bg);
      border: 1px solid var(--border);
    }
    .detail-inner h4 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .entries-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .entries-list li {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .entries-list li:last-child {
      border-bottom: 0;
    }
    .entries-list .name {
      font-family: var(--mono);
      color: var(--text);
    }
    .entries-list .eid {
      margin-left: auto;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--text-tertiary);
    }
    .entries-list .err {
      margin-left: auto;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--err);
    }
    .meta {
      margin-top: 12px;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--text-tertiary);
    }
    code {
      font-family: var(--mono);
      font-size: 12px;
      background: var(--surface-2);
      padding: 1px 6px;
      border-radius: 4px;
    }
  `;

  @state() private expandedIdx: number | null = null;
  private unsubscribe: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribe = store.subscribe(() => this.requestUpdate());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private toggle(idx: number): void {
    this.expandedIdx = this.expandedIdx === idx ? null : idx;
  }

  override render() {
    const commits = store.state.recentCommits;
    return html`
      <h1>Migrationsverlauf</h1>
      <p class="lede">Letzte Konvertier-Vorgänge dieser Sitzung.</p>
      <knx-card>
        <div class="toolbar">
          <label
            >Bereich
            <select disabled>
              <option>Alle</option>
            </select>
          </label>
          <label
            >Status
            <select disabled>
              <option>Alle</option>
            </select>
          </label>
        </div>
        ${commits.length === 0
          ? html`
              <div class="empty">
                <knx-icon name="clock"></knx-icon>
                <p>Noch keine Migrationen in dieser Sitzung.</p>
                <p class="small">
                  Konvertier-Vorgänge erscheinen hier, sobald sie übernommen wurden.
                </p>
              </div>
            `
          : html`
              <table class="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Zeit</th>
                    <th>Bereich</th>
                    <th>Status</th>
                    <th>Einträge</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${commits.map((rc, idx) => {
                    const c = rc.commit;
                    const sum = summarize(c);
                    const total = c.entries.length;
                    const ok = c.entries.filter((e) => e.applied).length;
                    const open = this.expandedIdx === idx;
                    return html`
                      <tr
                        class="row ${open ? "open" : ""}"
                        @click=${() => this.toggle(idx)}
                      >
                        <td class="num">#${c.migration_id}</td>
                        <td class="time">${formatTime(rc.capturedAt)}</td>
                        <td class="domain">
                          ${DOMAIN_LABEL[c.domain] ?? c.domain}
                        </td>
                        <td class="status">
                          <knx-pill kind=${sum.kind} .showDot=${false}
                            >${sum.label}</knx-pill
                          >
                        </td>
                        <td class="entries">${ok}/${total}</td>
                        <td class="caret">
                          <knx-icon name="chevron-right"></knx-icon>
                        </td>
                      </tr>
                      ${open
                        ? html`
                            <tr class="detail">
                              <td colspan="6">
                                <div class="detail-inner">
                                  <h4>Einträge</h4>
                                  <ul class="entries-list">
                                    ${c.entries.map(
                                      (e) => html`
                                        <li>
                                          ${e.applied
                                            ? html`<knx-pill
                                                kind="ok"
                                                .showDot=${false}
                                                >ok</knx-pill
                                              >`
                                            : html`<knx-pill
                                                kind="err"
                                                .showDot=${false}
                                                >Fehler</knx-pill
                                              >`}
                                          <span class="name">${e.name}</span>
                                          ${e.applied
                                            ? html`<span class="eid"
                                                >${e.entity_id ?? ""}</span
                                              >`
                                            : html`<span class="err"
                                                >${e.error ?? ""}</span
                                              >`}
                                        </li>
                                      `,
                                    )}
                                  </ul>
                                  <div class="meta">
                                    Datei <code>${c.path}</code>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          `
                        : ""}
                    `;
                  })}
                </tbody>
              </table>
            `}
      </knx-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-view": HistoryView;
  }
}
