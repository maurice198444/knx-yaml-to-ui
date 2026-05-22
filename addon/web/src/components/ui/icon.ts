import { LitElement, html, svg, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

// Lucide-style 24x24 stroke-1.5 icon paths. Only icons we actually use.
const ICONS = {
  check: svg`<path d="M20 6 9 17l-5-5"/>`,
  x: svg`<path d="M18 6 6 18M6 6l12 12"/>`,
  sun: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>`,
  moon: svg`<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`,
  "chevron-right": svg`<path d="m9 18 6-6-6-6"/>`,
  "chevron-left": svg`<path d="m15 18-6-6 6-6"/>`,
  "alert-circle": svg`<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>`,
  file: svg`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>`,
  lightbulb: svg`<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>`,
  activity: svg`<path d="M3 12h4l3 8 4-16 3 8h4"/>`,
  layout: svg`<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 14h18M3 19h18"/>`,
  thermometer: svg`<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>`,
  refresh: svg`<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>`,
  trash: svg`<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>`,
  power: svg`<path d="M18.36 6.64a9 9 0 1 1-12.72 0M12 2v10"/>`,
  clock: svg`<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`,
  settings: svg`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
} as const;

export type IconName = keyof typeof ICONS;

@customElement("knx-icon")
export class KnxIcon extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      width: 1em;
      height: 1em;
      color: currentColor;
    }
    svg {
      width: 100%;
      height: 100%;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `;

  @property() name!: IconName;

  override render() {
    const path = ICONS[this.name];
    if (!path) return nothing;
    return html`<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "knx-icon": KnxIcon;
  }
}
