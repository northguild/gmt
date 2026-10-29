/**
 * zoneMapTooltip: the body of the timezone map's hover card. The zone name in
 * bold, and under it the local time and the offset, both starting at the left
 * edge. The chart library draws the card's shell; this is what goes inside it.
 */
import { html, type SafeHtml } from "~/widgets/builders";
import styles from "./zone-map-tooltip.module.css";

export interface ZoneMapTooltipOptions {
  /** The zone's display name, such as `Asia/Tokyo`. */
  name: string;
  /** The local time with no fraction of a second, such as `2027-03-08T07:00:00`. */
  time: string;
  /** The offset after `GMT`, such as `+09:00`. */
  offset: string;
}

export function zoneMapTooltip(o: ZoneMapTooltipOptions): SafeHtml {
  return html`<div class="${styles.root}">
    <strong class="${styles.name}">${o.name}</strong>
    <p class="${styles.row}">
      <span class="${styles.time}">${o.time}</span>
      <span class="${styles.offset}">GMT${o.offset}</span>
    </p>
  </div>`;
}
