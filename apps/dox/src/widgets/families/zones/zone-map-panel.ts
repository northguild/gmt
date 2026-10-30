/**
 * zoneMapPanel: the timezone map's clock panel. One native button per zone, each holding the
 * zone's name, its offset from GMT and its local time. Pressing a button selects that zone on the
 * map (`aria-pressed`, the APG toggle button pattern; Enter and Space come with `<button>`).
 *
 * The offset and the time start empty and are filled once a second by the map's mount, which finds
 * them by `data-tz-field` inside the button named by `data-tz-id`. A button's accessible name is
 * its text, so a reader hears the zone, then its offset and time.
 */
import { gateAttr } from "~/widgets/builders/gate";
import { html, type SafeHtml } from "~/widgets/builders/html";
import styles from "./zone-map-panel.module.css";

interface ZoneMapPanelOptions {
  /** The zones to list, in order. */
  zones: readonly { id: string }[];
  /** The group's accessible name. */
  label: string;
  /** The panel's id, which the mount finds it by. */
  id: string;
}

export function zoneMapPanel(o: ZoneMapPanelOptions): SafeHtml {
  const entries = o.zones.map(
    (zone) => html`<button
      class="${styles.entry}"
      type="button"
      aria-pressed="false"
      data-tz-id="${zone.id}"
    >
      <span class="${styles.row}">
        <span class="${styles.name}">${zone.id}</span>
        <span
          class="${styles.offset}"
          ${gateAttr("live")}
          data-tz-field="offset"
        ></span>
      </span>
      <span class="${styles.time}" ${gateAttr("live")} data-tz-field="time"></span>
    </button>`,
  );
  return html`<div class="${styles.panel}" id="${o.id}" role="group" aria-label="${o.label}">${entries}</div>`;
}
