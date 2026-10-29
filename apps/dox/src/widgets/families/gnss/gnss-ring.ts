/**
 * gnssRing: the odometer ring, a pure SVG drawing of a GNSS week counter.
 *
 * The counter's weeks run round a circle; each lap is one era, outside in; one hand crosses
 * every lap at the reading's week, so one week number is seen to name several dates. The lap
 * the reading resolves to is lit and carries a filled arc; the others are faint with a hollow
 * dot. The drawing is decoration (`aria-hidden`): the lane sentences beside it carry the same
 * facts as text. Its hub says "NO SIGNAL" in words when the library gave no reading, never a
 * blank hub.
 *
 * The tick labels divide the modulus evenly: a drawing, not a library calculation.
 */
import { html, raw, type SafeHtml } from "../../builders/html";
import styles from "./gnss-ring.module.css";

export type RingState = "live" | "lost" | "idle";

export interface RingLap {
  /** The era's label, written on the lap's seam. Null draws a faint lap with no label. */
  label: string | null;
  /** The reading's place on the lap, 0..100 (percent of a turn). Null draws no dot. */
  pin: number | null;
  /** Today's place on the lap, 0..100. Null draws no mark. */
  today: number | null;
  /** The lap the reading resolves to. */
  chosen: boolean;
  /** The lap begins after a gap, so its track is dotted. */
  gap: boolean;
}

export interface GnssRingOptions {
  /** The counter's weeks per lap. Sets the tick labels. */
  modulus: number;
  state: RingState;
  /** One slot for each lap, outside in. Null leaves a lap undrawn. */
  laps: readonly (RingLap | null)[];
  /** The hand's place, 0..100. Null draws no hand. */
  hand: number | null;
  /** The hub's small top line. */
  cap: string;
  /** The hub's big line. */
  week: string;
  /** The hub's small bottom line. */
  sub: string;
}

const C = 170;
export const RING_RADII = [112, 94, 76, 58] as const;
/** The plate under a lap's era label: room for the longest label at 13px mono. */
const ERA_PLATE_W = 52;
const TICK_FROM = 122;
const LABEL_AT = 151;
/** Ticks round the ring: a minor tick every 1/32 of the modulus, a labelled one every 1/8. */
const TICKS = 32;
const LABEL_EVERY = 4;

const at = (turns: number, r: number): [number, number] => [
  C + r * Math.sin(turns * 2 * Math.PI),
  C - r * Math.cos(turns * 2 * Math.PI),
];
const f1 = (n: number) => n.toFixed(1);
const turn = (percent: number) => `--turn: ${(percent * 3.6).toFixed(2)}deg`;

function ticks(modulus: number): SafeHtml {
  const out: SafeHtml[] = [];
  for (let k = 0; k < TICKS; k++) {
    const major = k % LABEL_EVERY === 0;
    const [x1, y1] = at(k / TICKS, TICK_FROM);
    const [x2, y2] = at(k / TICKS, TICK_FROM + (major ? 9 : 5));
    out.push(
      html`<line class="${styles.tick}" data-major="${String(major)}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`,
    );
    if (major) {
      const [lx, ly] = at(k / TICKS, LABEL_AT);
      out.push(
        html`<text class="${styles.tickLabel}" x="${f1(lx)}" y="${f1(ly + 3.5)}" text-anchor="middle">${String(Math.round((k / TICKS) * modulus))}</text>`,
      );
    }
  }
  return html`${out}`;
}

function lap(r: number, l: RingLap | null): SafeHtml {
  if (l === null) return html``;
  const share = l.chosen && l.pin !== null ? l.pin : 0;
  return html`<g class="${styles.lap}" data-chosen="${String(l.chosen)}" data-gap="${String(l.gap)}" data-empty="${String(l.pin === null)}">
    <circle class="${styles.track}" cx="${C}" cy="${C}" r="${r}"/>
    <circle class="${styles.fill}" cx="${C}" cy="${C}" r="${r}" pathLength="100" transform="rotate(-90 ${C} ${C})" style="stroke-dasharray: ${share} ${100 - share}"/>
    ${l.today === null ? "" : html`<g class="${styles.spin}" style="${turn(l.today)}"><line class="${styles.todayMark}" x1="${C}" y1="${C - r - 8}" x2="${C}" y2="${C - r + 8}"/></g>`}
    <g class="${styles.spin}" style="${turn(l.pin ?? 0)}"><circle class="${styles.dot}" cx="${C}" cy="${C - r}" r="5.5"/></g>
    ${l.label === null ? "" : html`<rect class="${styles.eraPlate}" x="${C - 8 - ERA_PLATE_W}" y="${C - r - 9}" width="${ERA_PLATE_W + 4}" height="18" rx="3"/><text class="${styles.era}" x="${C - 8}" y="${C - r + 4.5}" text-anchor="end">${l.label}</text>`}
  </g>`;
}

export function gnssRing(o: GnssRingOptions): SafeHtml {
  return html`<div class="${styles.ring}" data-state="${o.state}" aria-hidden="true"
    ><svg viewBox="0 0 ${2 * C} ${2 * C}" focusable="false"
      ><g>${ticks(o.modulus)}</g
      >${o.hand === null ? "" : html`<g class="${styles.spin} ${styles.hand}" style="${turn(o.hand)}"><line x1="${C}" y1="${C - 50}" x2="${C}" y2="${C - RING_RADII[0] - 9}"/></g>`}${RING_RADII.map((r, i) => lap(r, o.laps[i] ?? null))}<g
        ><text class="${styles.cap}" x="${C}" y="${C - 16}" text-anchor="middle">${o.cap}</text
        ><text class="${styles.week}" x="${C}" y="${C + 10}" text-anchor="middle">${o.week}</text
        ><text class="${styles.sub}" x="${C}" y="${C + 28}" text-anchor="middle">${o.sub}</text></g
      ></svg
    ></div
  >`;
}

export { raw };
