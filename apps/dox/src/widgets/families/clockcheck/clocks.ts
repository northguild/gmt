/**
 * clocks: the live clocks of a dated clock-change checker, one per zone.
 *
 * Each item is a crystal-clock face, the zone id and a time line. The time line is plain text, not
 * a live region, so the second ticking never reaches a screen reader; the face carries the spoken
 * time. The list is server-rendered with the `NO SIGNAL` sentinel in every time line, and
 * `wireClocks` (`~/lib/clock-change-clocks`) draws them once the answer arrives.
 *
 * `clockSlug`/`clockId` give the ids, so the builder and the wiring agree on them.
 */
import { html, type SafeHtml } from "../../builders/html";
import { idScope } from "../../builders/ids";
import { noSignal, zoneId } from "./marks";
import styles from "./clocks.module.css";

export interface ClocksConfig {
  /** Namespaces every id. */
  idPrefix: string;
  zones: readonly string[];
  /** The zones that stop changing their clocks; the rest still change. */
  stopped: ReadonlySet<string>;
}

/** A zone id as an id-safe word: `Africa/El_Aaiun` is `Africa-El-Aaiun`. */
export function clockSlug(zone: string): string {
  return zone.replace(/[^A-Za-z0-9]/g, "-");
}

/** The local part names of one clock, as `findWidget(...).part(name)` takes them. */
export const CLOCK_PARTS = {
  list: "clocks",
  item: (zone: string): string => `clock-${clockSlug(zone)}`,
  face: (zone: string): string => `clock-${clockSlug(zone)}-face`,
  time: (zone: string): string => `clock-${clockSlug(zone)}-time`,
} as const;

/** The time line of a clock that has a reading: the wall time, then its offset. */
export function clockTime(wall: string, offset: string): SafeHtml {
  return html`<span class="${styles.hm}">${wall}</span> <span class="${styles.off}">${offset}</span>`;
}

/** The time line of a clock with no reading. */
export function clockNoSignal(): SafeHtml {
  return noSignal();
}

function clockItem(
  id: (local: string) => string,
  zone: string,
  stopped: ReadonlySet<string>,
): SafeHtml {
  return html`<li
    id="${id(CLOCK_PARTS.item(zone))}"
    class="${styles.clock} ${stopped.has(zone) ? styles.stopped : styles.changes}"
    data-gate="clock"
    data-zone="${zone}"
  >
    <div class="${styles.face}" id="${id(CLOCK_PARTS.face(zone))}"></div>
    <p class="${styles.zone}"><code>${zoneId(zone)}</code></p>
    <p class="${styles.time}" id="${id(CLOCK_PARTS.time(zone))}" data-gate="clock-time">${clockNoSignal()}</p>
  </li>`;
}

/** The list of clocks, each with a `NO SIGNAL` time line until the answer arrives. */
export function clocks(config: ClocksConfig): SafeHtml {
  const id = idScope(config.idPrefix);
  return html`<ul class="${styles.clocks}" id="${id(CLOCK_PARTS.list)}">${config.zones.map(
    (zone) => clockItem(id, zone, config.stopped),
  )}</ul>`;
}
