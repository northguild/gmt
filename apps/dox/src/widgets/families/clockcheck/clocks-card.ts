/**
 * clocksCard: the "Live clocks" card that sits beside the zone list (`zoneMap`'s `clocks` slot).
 *
 * A notice that is hidden until the browser's own tz data is stale (`wireZoneMap` shows it, under
 * `<prefix>-clocks-notice`), the clocks, and a line saying what they show.
 */
import { html, type SafeHtml } from "../../builders/html";
import { idScope } from "../../builders/ids";
import { section } from "../../builders/layout";
import { clocks } from "./clocks";
import styles from "./clocks-card.module.css";

interface ClocksCardOptions {
  idPrefix: string;
  zones: readonly string[];
  stopped: ReadonlySet<string>;
  /** What the notice says when the data is stale. */
  notice: SafeHtml;
}

export function clocksCard(o: ClocksCardOptions): SafeHtml {
  const id = idScope(o.idPrefix);
  return section(
    { id: id("clocks"), heading: "Live clocks", level: 4, gate: "clocks" },
    html`<div class="${styles.body}">
      <p class="${styles.notice}" id="${id("clocks-notice")}" hidden>${o.notice}</p>
      <div class="${styles.list}">${clocks({ idPrefix: o.idPrefix, zones: o.zones, stopped: o.stopped })}</div>
      <p class="${styles.hint}">Your time, and the time in each zone.</p>
    </div>`,
  );
}
