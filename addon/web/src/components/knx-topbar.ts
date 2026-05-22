import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./knx-tabs.js";
import "./ui/icon.js";
import "./ui/live-dot.js";
import type { LiveStatus } from "./ui/live-dot.js";
import type { Route } from "../router.js";
import { navigate } from "../router.js";
import { effectiveTheme, readThemePref, setThemePref } from "../theme.js";
import type { ThemePref } from "../theme.js";

const TABS = [
  { id: "convert", label: "Konvertieren" },
  { id: "entities", label: "Entitäten" },
  { id: "history", label: "Verlauf" },
];

const WS_LABEL: Record<LiveStatus, string> = {
  open: "verbunden",
  connecting: "verbinde…",
  closed: "getrennt",
};

@customElement("knx-topbar")
export class KnxTopbar extends LitElement {
  static override styles = css`
    :host {
      display: block;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .bar {
      height: 64px;
      display: flex;
      align-items: center;
      padding: 0 24px;
      gap: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--accent);
      display: grid;
      place-items: center;
      color: #fff;
      font-weight: 700;
      font-size: 18px;
      box-shadow: 0 2px 8px var(--accent-soft);
    }
    .name {
      font-size: 18px;
      font-weight: 500;
    }
    .ver {
      font-family: var(--mono);
      font-size: 12px;
      color: var(--text-tertiary);
    }
    knx-tabs {
      margin-left: auto;
    }
    .right {
      display: flex;
      align-items: center;
      gap: 4px;
      padding-left: 8px;
    }
    .ws-status {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 7px 14px;
      margin-right: 6px;
      border-radius: 999px;
      background: var(--surface-2);
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
    }
    .ws-status .bigdot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: var(--text-tertiary);
      box-shadow: 0 0 0 0 transparent;
      transition: background 0.2s;
    }
    .ws-status.open .bigdot {
      background: var(--ok);
      animation: ws-pulse 2.2s infinite;
    }
    .ws-status.connecting .bigdot {
      background: var(--warn);
      animation: ws-pulse 1.1s infinite;
    }
    .ws-status.closed .bigdot {
      background: var(--err);
    }
    .ws-status.open {
      color: var(--ok);
      background: var(--ok-bg);
    }
    .ws-status.connecting {
      color: var(--warn);
      background: var(--warn-bg);
    }
    .ws-status.closed {
      color: var(--err);
      background: var(--err-bg);
    }
    @keyframes ws-pulse {
      0%,
      100% {
        box-shadow: 0 0 0 0 currentColor;
      }
      50% {
        box-shadow: 0 0 0 6px transparent;
      }
    }
    .icon-btn {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      border: 0;
      background: none;
      cursor: pointer;
      color: var(--text-secondary);
      display: grid;
      place-items: center;
      font-size: 20px;
      transition: all 0.15s;
    }
    .icon-btn:hover {
      background: var(--surface-2);
      color: var(--text);
    }
  `;

  @property() route: Route = "convert";
  @property() wsStatus: LiveStatus = "closed";
  @property() version = "0.1.0-dev";

  @state() private themePref: ThemePref = readThemePref();

  private onTab(e: CustomEvent<string>) {
    navigate(e.detail as Route);
  }

  private cycleTheme = () => {
    const order: ThemePref[] = ["auto", "light", "dark"];
    const next = order[(order.indexOf(this.themePref) + 1) % order.length]!;
    this.themePref = next;
    setThemePref(next);
  };

  private themeIconName() {
    const eff = effectiveTheme(this.themePref);
    return eff === "dark" ? "sun" : "moon";
  }

  override render() {
    return html`
      <div class="bar">
        <div class="brand">
          <div class="logo">K</div>
          <div class="name">KNX YAML</div>
          <div class="ver">v${this.version}</div>
        </div>
        <knx-tabs
          .items=${TABS}
          .active=${this.route}
          variant="soft"
          @change=${this.onTab}
        ></knx-tabs>
        <div class="right">
          <span
            class="ws-status ${this.wsStatus}"
            title="WebSocket-Status: ${WS_LABEL[this.wsStatus]}"
          >
            <span class="bigdot"></span>${WS_LABEL[this.wsStatus]}
          </span>
          <button
            class="icon-btn"
            title="Theme: ${this.themePref}"
            @click=${this.cycleTheme}
          >
            <knx-icon .name=${this.themeIconName()}></knx-icon>
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "knx-topbar": KnxTopbar;
  }
}
