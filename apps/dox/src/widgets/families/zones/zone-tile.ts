/**
 * zoneTile: one pinned zone's clock in the Zone Planner.
 *
 * An `<article>` named by the zone's short name, holding the face, the reading, the date,
 * the offset, a DST slot, a clock-change slot and a remove button. The reading is not live:
 * a drag moves every tile at once, so the planner announces the settled change once instead.
 *
 * Both slots are one line tall in every state, so a zone entering or leaving DST while the
 * reader drags never changes a tile's height. The mount fills the parts (it finds them with
 * the scoped `id`) and sets `data-state` on the DST pill and the time; the builder writes only
 * the structure.
 */
import { html, type SafeHtml } from "~/widgets/builders";
import styles from "./zone-tile.module.css";

interface ZoneTileOptions {
  /** The tile's own id maker: `id("time")` is the id of the tile's time. */
  id: (local: string) => string;
  /** The IANA id, kept in full as the name's tooltip. */
  zone: string;
  /** The short name shown and used as the tile's name, such as "Tokyo". */
  name: string;
  /** Whether this is the reader's own zone. */
  yours: boolean;
}

/** The accessible name of a tile's remove button. */
export const removeLabel = (zone: string, yours: boolean): string =>
  `Remove ${zone}${yours ? " (your time zone)" : ""}`;

export function zoneTile(o: ZoneTileOptions): SafeHtml {
  const { id } = o;
  return html`<article
    class="${styles.tile}"
    data-enter
    aria-labelledby="${id("name")}"
    ${o.yours ? html`data-yours` : ""}
  >
    <div class="${styles.face}" id="${id("face")}" data-gate="live live-face"></div>
    <p class="${styles.time}" id="${id("time")}" data-gate="live">&nbsp;</p>
    <p class="${styles.date}" id="${id("date")}" data-gate="live">&nbsp;</p>
    <p class="${styles.name}" id="${id("name")}" title="${o.zone}">${o.name}</p>
    <p class="${styles.offset}" id="${id("offset")}" data-gate="live">&nbsp;</p>
    <p class="${styles.slot}"><span class="${styles.dst}" id="${id("dst")}" data-gate="live"></span></p>
    <p class="${styles.slot}"><span class="${styles.change}" id="${id("change")}" data-gate="live"></span></p>
    ${o.yours ? html`<p class="${styles.yours}">Your time zone</p>` : ""}
    <button
      class="${styles.remove}"
      type="button"
      id="${id("remove")}"
      aria-label="${removeLabel(o.zone, o.yours)}"
    ><span aria-hidden="true">✕</span></button>
  </article>`;
}
