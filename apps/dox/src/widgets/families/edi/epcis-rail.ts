/**
 * The EPCIS Event Reader's two day rails: the same instant on a UTC rail and on the clock at the
 * event's offset. Each rail is a head (the clock's name, its date) over a track of days; the day
 * the instant falls in is lit, every midnight is a hairline labelled `00:00`, and one pin marks
 * the instant. Positions are drawing; the date on the head and every word is the library's.
 *
 * With nothing to draw the track keeps its box and says why in words, never in amber: nothing
 * here is a refused call. A rail is one picture (`role="img"`) named by `RailSpec.aria`.
 *
 * `epcisRail` is the kit's hold around one rail: the live rail is written by the mount into the
 * element with the id, and the ghosts reserve the widest rail and every empty-state sentence, so
 * a change moves nothing below it.
 */
import {
  tickLabelEnd,
  type RailLayout,
  type RailSpec,
} from "~/lib/epcis-event-reader";
import { html, type SafeHtml } from "../../builders/html";
import { hold } from "./edi-hold";
import styles from "./epcis-rail.module.css";

const fixed = (n: number): string => n.toFixed(3);

function days(layout: RailLayout, pin: number): SafeHtml {
  return html`${layout.days.map(
    (d) =>
      html`<span class="${d.lit ? styles.lit : styles.day}" style="--from:${fixed(d.from)}%;--to:${fixed(d.to)}%"></span>`,
  )}${layout.ticks.map(
    (at) =>
      html`<span class="${tickLabelEnd(at) ? styles.tickEnd : styles.tick}" style="--x:${fixed(at)}%"
        ><span class="${styles.tickLabel}">00:00</span></span
      >`,
  )}<span class="${styles.pin}" style="--x:${fixed(pin)}%"></span>`;
}

/**
 * One rail: the clock's name to the left, its date to the right, the track under them. A ghost
 * (`ghost: true`) is the same box with no role, for the hold's reserve.
 */
export function railContent(spec: RailSpec, ghost = false): SafeHtml {
  const track =
    spec.layout === null
      ? html`<div class="${styles.trackEmpty}"><p class="${styles.emptyText}">${spec.emptyText}</p></div>`
      : html`<div class="${styles.track}">${days(spec.layout, spec.pin)}</div>`;
  const picture = ghost ? html`` : html`role="img" aria-label="${spec.aria}"`;
  return html`<div class="${styles.rail} ${spec.role === "utc" ? styles.utc : styles.local}" ${picture}
    ><div class="${styles.head}"><span class="${styles.name}">${spec.name}</span><span class="${styles.date}">${spec.date}</span></div
    >${track}</div
  >`;
}

interface EpcisRailOptions {
  id: string;
  spec: RailSpec;
  /** The rail at its widest and every empty state, as specs. */
  reserve: readonly RailSpec[];
}

export function epcisRail(o: EpcisRailOptions): SafeHtml {
  return hold({
    id: o.id,
    content: railContent(o.spec),
    ghosts: o.reserve.map((s) => railContent(s, true)),
  });
}
