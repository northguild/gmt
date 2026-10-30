/**
 * zoneMapShell: the timezone map's markup. A region holding the map's host, the credit for the
 * zone boundaries it draws, and the clock panel under it. The chart itself is drawn into the host
 * by `lib/timezone-map.ts`.
 */
import { html, raw, widget, type SafeHtml } from "~/widgets/builders";
import { idScope } from "~/widgets/builders/ids";
import { zoneMapPanel } from "./zone-map-panel";
import styles from "./zone-map-shell.module.css";

interface ZoneMapShellOptions {
  /** The template's `idPrefix`. */
  idPrefix: string;
  /** The zones the clock panel lists. */
  zones: readonly { id: string }[];
  /** An optional heading above the map. */
  title?: string | undefined;
  /** An optional line under the panel. */
  caption?: string | undefined;
  /** The data-credit button and popover, as `renderDataCreditsHtml` returns them. */
  credits: string;
}

export function zoneMapShell(o: ZoneMapShellOptions): SafeHtml {
  const id = idScope(o.idPrefix);
  return widget(
    { name: "timezone-map", label: "Timezone map", scope: o.idPrefix },
    html`<div class="${styles.shell}">
      ${o.title === undefined || o.title === "" ? "" : html`<h3 class="gmt-chart-title">${o.title}</h3>`}
      <!-- Map fills the chart refers to by id: a cyan diagonal fade on each land tile over a faint radial ocean. -->
      <svg class="gmt-chart-defs" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="gmt-map-ocean" cx="0.5" cy="0.45" r="0.6">
            <stop offset="0" style="stop-color: var(--gmt-cyan); stop-opacity: 0.1" />
            <stop offset="1" style="stop-color: var(--gmt-cyan); stop-opacity: 0.02" />
          </radialGradient>
          <linearGradient id="gmt-map-land" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style="stop-color: var(--gmt-cyan); stop-opacity: 0.42" />
            <stop offset="1" style="stop-color: var(--gmt-cyan); stop-opacity: 0.22" />
          </linearGradient>
        </defs>
      </svg>
      <div class="${styles.creditedFrame}" data-gate="credited-frame">
        <div id="${id("host")}" class="gmt-chart gmt-glass ${styles.host}"></div>
        ${raw(o.credits)}
      </div>
      <div class="${styles.panel}">
        ${zoneMapPanel({ zones: o.zones, label: "Time zones", id: id("panel") })}
      </div>
      ${o.caption === undefined || o.caption === "" ? "" : html`<p class="gmt-chart-caption">${o.caption}</p>`}
    </div>`,
  );
}
