import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./knx-topbar.js";
import "../views/convert-view.js";
import "../views/entities-view.js";
import "../views/history-view.js";
import { currentRoute, onRouteChange } from "../router.js";
import type { Route } from "../router.js";
import { ws } from "../api/ws.js";
import type { LiveStatus } from "./ui/live-dot.js";

@customElement("knx-app")
export class KnxApp extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    main {
      flex: 1;
      padding: 28px 24px 56px;
      max-width: 1080px;
      margin: 0 auto;
      width: 100%;
    }
  `;

  @state() private route: Route = currentRoute();
  @state() private wsStatus: LiveStatus = ws.status;
  private unsubRoute?: () => void;
  private unsubWs?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    this.unsubRoute = onRouteChange((r) => {
      this.route = r;
    });
    const onWsStatus = () => {
      this.wsStatus = ws.status;
    };
    ws.addEventListener("status", onWsStatus);
    this.unsubWs = () => ws.removeEventListener("status", onWsStatus);
    // WS is a singleton tied to app lifetime, not to any single view: the
    // topbar status pill must reflect connection state on every tab.
    ws.connect();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubRoute?.();
    this.unsubWs?.();
  }

  override render() {
    return html`
      <knx-topbar .route=${this.route} .wsStatus=${this.wsStatus}></knx-topbar>
      <main>${this.renderView()}</main>
    `;
  }

  private renderView() {
    switch (this.route) {
      case "convert":
        return html`<convert-view></convert-view>`;
      case "entities":
        return html`<entities-view></entities-view>`;
      case "history":
        return html`<history-view></history-view>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "knx-app": KnxApp;
  }
}
