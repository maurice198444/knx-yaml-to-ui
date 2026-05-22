import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./knx-topbar.js";
import "../views/convert-view.js";
import "../views/entities-view.js";
import "../views/history-view.js";
import { currentRoute, onRouteChange } from "../router.js";
import type { Route } from "../router.js";

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
  private unsub?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    this.unsub = onRouteChange((r) => {
      this.route = r;
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.unsub?.();
  }

  override render() {
    return html`
      <knx-topbar .route=${this.route}></knx-topbar>
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
