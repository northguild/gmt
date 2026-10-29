/**
 * crystalClock: a shared analog clock face, drawn as an SVG.
 *
 * A thin 12-sided (dodecagon) outline around a dial, with hour and minute hands, a small
 * centre cap, and a clear ice-glass pane over the whole face. The outline is a hairline
 * with 12 sides, so each side sits under one hour position (`vertexAngle`). It is not a
 * shrunk Dox mark: the mark's facet ring and spokes are reserved for the mark.
 *
 * The caller resolves the wall-clock hour and minute from the library first; this module
 * only turns an hour and a minute into hand angles and markup, and never reads a clock, a
 * zone or a duration.
 *
 * Accessibility. With `glowable` (the default) the face sits in a real
 * `<button type="button">` carrying `aria-pressed`: a night-light toggle that lights the
 * face, like the backlight on a digital watch. The button holds the one accessible name
 * (the written time, the offset and the zone) and the SVG inside is `aria-hidden`. With
 * `glowable: false` the SVG is `role="img"` with the same name. The hands, ticks and glass
 * are decoration either way, and the seconds never enter the name, so a ticking face does
 * not announce every second.
 *
 * Every colour is a token, applied by `crystal-clock.module.css`; `state` selects a
 * `data-state` the module reads, never a literal here. The glass's gradients, clip path and
 * drop-shadow filter live in this markup (SVG paints them by `url(#id)`), and each id is
 * suffixed with the caller's `id` so two clocks on one page never share glass.
 *
 * The highlight draws one affected wall-clock hour as a sector between the tick ring and
 * the centre: `skipped` a single dashed wedge, `repeated` two concentric solid arcs, so the
 * two read apart by shape before colour.
 */
import { html, type SafeHtml } from "../../builders/html";
import styles from "./crystal-clock.module.css";

/** Square viewBox: a dodecagon is near-circular. */
export const CLOCK_VIEWBOX = "0 0 100 100";

const CENTER_X = 50;
const CENTER_Y = 50;
const VERTEX_COUNT = 12;
/** The bezel outline, close to the viewBox edge: the frame is a hairline. */
const OUTER_RADIUS = 46;
/** The tick ring's outer radius, a small inset from the bezel. */
const DIAL_RADIUS = 40;
const TICK_MINOR_LENGTH = 3;
const TICK_MAJOR_LENGTH = 6;
const HOUR_HAND_LENGTH = DIAL_RADIUS * 0.45;
const MINUTE_HAND_LENGTH = DIAL_RADIUS * 0.8;
/** The optional second hand reaches the tick ring. */
const SECOND_HAND_LENGTH = DIAL_RADIUS * 0.88;
const CAP_RADIUS = 2.2;

function polar(radius: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CENTER_X + radius * Math.cos(rad), CENTER_Y + radius * Math.sin(rad)];
}

/** Trims float noise (`43.50000000000001`) out of the emitted markup. */
function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/**
 * Vertex `i`'s angle (degrees clockwise from 12), `i` 0 to 11. Offset by 15 degrees from the
 * hour angles (`i * 30`), so a flat side, not a corner, sits at each hour position.
 */
function vertexAngle(i: number): number {
  return i * 30 + 15;
}

function polygonPoints(radius: number): string {
  const pts: string[] = [];
  for (let i = 0; i < VERTEX_COUNT; i++) {
    const [x, y] = polar(radius, vertexAngle(i));
    pts.push(`${fmt(x)},${fmt(y)}`);
  }
  return pts.join(" ");
}

/** The bezel outline, and the glass pane's own silhouette, so the glass reaches every edge. */
export const CLOCK_OUTER: string = polygonPoints(OUTER_RADIUS);

export type CrystalClockState = "normal" | "repeated" | "skipped" | "naive";

/** One wall-clock hour drawn as a sector on the dial, copied from a real DST search. */
export interface CrystalClockHighlight {
  fromHour: number;
  fromMinute: number;
  toHour: number;
  toMinute: number;
  /** Shape carries the meaning, not colour alone. */
  kind: "skipped" | "repeated";
}

export interface CrystalClockOptions {
  /** Unique per instance on a page: every glass id is suffixed with it. */
  id: string;
  /** 0 to 23, the wall-clock hour the caller already resolved. */
  hour: number;
  /** 0 to 59. */
  minute: number;
  /** 0 to 59. When set, a second hand is drawn; it never enters the accessible name. */
  second?: number;
  /** The accessible name's subject, such as "Entry clock". */
  label: string;
  /** Appended to `label` for the name, such as "01:30, minus 04:00, New York". */
  sublabel?: string;
  state?: CrystalClockState;
  /** Pixel width; omitted, the module sizes it to its container. */
  size?: number;
  /** Wrap the face in the night-light toggle. Default `true`. */
  glowable?: boolean;
  /** Draws the affected hour and folds its words into the accessible name. */
  highlight?: CrystalClockHighlight;
}

export interface HandAngles {
  /** Degrees clockwise from 12 o'clock, 0 to 360. */
  hourDeg: number;
  minuteDeg: number;
}

/** The hand angles for a wall-clock reading. A 24-hour `hour` folds onto the 12-hour face. */
export function handAngles(hour: number, minute: number): HandAngles {
  const twelveHour = (hour % 12) + minute / 60;
  return {
    hourDeg: (twelveHour / 12) * 360,
    minuteDeg: (minute / 60) * 360,
  };
}

/** Where a hand's tip sits at `deg`, as the `x2`/`y2` attribute text. */
export function handTip(
  kind: "hour" | "minute",
  deg: number,
): { x2: string; y2: string } {
  const [x, y] = polar(
    kind === "hour" ? HOUR_HAND_LENGTH : MINUTE_HAND_LENGTH,
    deg,
  );
  return { x2: fmt(x), y2: fmt(y) };
}

function line(
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
  cls: string,
  extra: SafeHtml = html``,
): SafeHtml {
  return html`<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" class="${cls}" ${extra} />`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function wallLabel(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** A pie-wedge outline from the centre out to `radius`, sweeping clockwise. */
function sectorOutlinePath(
  radius: number,
  fromDeg: number,
  toDeg: number,
): string {
  const [x1, y1] = polar(radius, fromDeg);
  const [x2, y2] = polar(radius, toDeg);
  const delta = (((toDeg - fromDeg) % 360) + 360) % 360;
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${fmt(CENTER_X)} ${fmt(CENTER_Y)} L ${fmt(x1)} ${fmt(y1)} A ${fmt(radius)} ${fmt(radius)} 0 ${largeArc} 1 ${fmt(x2)} ${fmt(y2)} Z`;
}

/** Just the curved edge at `radius`: two at different radii are the repeated hour. */
function arcOnlyPath(radius: number, fromDeg: number, toDeg: number): string {
  const [x1, y1] = polar(radius, fromDeg);
  const [x2, y2] = polar(radius, toDeg);
  const delta = (((toDeg - fromDeg) % 360) + 360) % 360;
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${fmt(x1)} ${fmt(y1)} A ${fmt(radius)} ${fmt(radius)} 0 ${largeArc} 1 ${fmt(x2)} ${fmt(y2)}`;
}

/** The dial paths one highlight draws: a wedge for a skipped hour, two concentric arcs for a repeated one. */
export function highlightPaths(highlight: CrystalClockHighlight): string[] {
  const { fromHour, fromMinute, toHour, toMinute, kind } = highlight;
  const fromDeg = handAngles(fromHour, fromMinute).hourDeg;
  const toDeg = handAngles(toHour, toMinute).hourDeg;
  const radius = DIAL_RADIUS - 1;
  return kind === "skipped"
    ? [sectorOutlinePath(radius, fromDeg, toDeg)]
    : [
        arcOnlyPath(radius, fromDeg, toDeg),
        arcOnlyPath(radius - 4, fromDeg, toDeg),
      ];
}

/** The affected hour as words ("02:00-03:00 never shown") and as the dial sector(s) it draws. */
function highlightOf(highlight: CrystalClockHighlight | undefined): {
  markup: SafeHtml;
  label: string | undefined;
} {
  if (!highlight) return { markup: html``, label: undefined };
  const { fromHour, fromMinute, toHour, toMinute, kind } = highlight;
  const span = `${wallLabel(fromHour, fromMinute)}–${wallLabel(toHour, toMinute)}`;
  const label =
    kind === "skipped" ? `${span} never shown` : `${span} shown twice`;
  const title = html`<title>${label}</title>`;
  const markup = html`${highlightPaths(highlight).map(
    (d) =>
      html`<path d="${d}" class="${styles.highlight}" data-kind="${kind}">${title}</path>`,
  )}`;
  return { markup, label };
}

function ticks(): SafeHtml {
  const parts: SafeHtml[] = [];
  for (let i = 0; i < 12; i++) {
    const deg = i * 30;
    const major = i % 3 === 0; // 12, 3, 6, 9
    const outer = polar(DIAL_RADIUS, deg);
    const inner = polar(
      DIAL_RADIUS - (major ? TICK_MAJOR_LENGTH : TICK_MINOR_LENGTH),
      deg,
    );
    parts.push(
      line(outer, inner, styles.tick!, html`data-major="${String(major)}"`),
    );
  }
  return html`${parts}`;
}

/** The accessible name: the label, its sublabel and the highlight's words. Never the seconds. */
export function crystalClockName(opts: CrystalClockOptions): string {
  const { label, sublabel, highlight } = opts;
  return [
    sublabel ? `${label}, ${sublabel}` : label,
    highlightOf(highlight).label,
  ]
    .filter((part): part is string => Boolean(part))
    .join(". ");
}

/** The night-light toggle's name: the face's name and what pressing it does. */
export function crystalClockToggleName(name: string): string {
  return `${name}. Light up the face.`;
}

/** The second hand points straight up and a CSS transform turns it, so the module can sweep it. */
function secondHand(second: number): SafeHtml {
  const [x2, y2] = polar(SECOND_HAND_LENGTH, 0);
  return html`<line x1="${CENTER_X}" y1="${CENTER_Y}" x2="${fmt(x2)}" y2="${fmt(y2)}" class="${styles.hand}" data-hand="second" data-turn="${second * 6}" style="transform: rotate(${second * 6}deg)" />`;
}

/** The face as an `<svg>`, or as the night-light button around one. */
export function crystalClock(opts: CrystalClockOptions): SafeHtml {
  const {
    id,
    hour,
    minute,
    state = "normal",
    size,
    glowable = true,
    highlight,
    second,
  } = opts;
  const { hourDeg, minuteDeg } = handAngles(hour, minute);
  const hourHand = polar(HOUR_HAND_LENGTH, hourDeg);
  const minuteHand = polar(MINUTE_HAND_LENGTH, minuteDeg);
  const { markup: highlightMarkup } = highlightOf(highlight);

  const clipId = `gmt-crystal-clip-${id}`;
  const tintId = `gmt-crystal-tint-${id}`;
  const sheenId = `gmt-crystal-sheen-${id}`;
  const shadowId = `gmt-crystal-shadow-${id}`;

  const name = crystalClockName(opts);
  const sizeAttr =
    size === undefined ? "" : html`width="${fmt(size)}" height="${fmt(size)}"`;
  // In the button the svg is decoration: the button holds the name and the pressed state.
  const a11y = glowable
    ? html`aria-hidden="true"`
    : html`role="img" aria-label="${name}"`;

  const svg = html`<svg class="${styles.clock} gmt-crystal-clock" data-state="${state}" data-clock-id="${id}" data-glow="false" viewBox="${CLOCK_VIEWBOX}" ${sizeAttr} ${a11y} focusable="false">
    <defs>
      <clipPath id="${clipId}"><polygon points="${CLOCK_OUTER}" /></clipPath>
      <linearGradient id="${tintId}" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stop-color="var(--gmt-ice)" stop-opacity="0.09" />
        <stop offset="42%" stop-color="var(--gmt-glass-tint-subtle)" />
        <stop offset="100%" stop-color="var(--gmt-teal)" stop-opacity="0.1" />
      </linearGradient>
      <radialGradient id="${sheenId}" cx="30%" cy="4%" r="85%">
        <stop offset="0%" stop-color="var(--gmt-ice)" stop-opacity="0.22" />
        <stop offset="35%" stop-color="var(--gmt-ice)" stop-opacity="0.08" />
        <stop offset="70%" stop-color="var(--gmt-ice)" stop-opacity="0.02" />
        <stop offset="100%" stop-color="var(--gmt-ice)" stop-opacity="0" />
      </radialGradient>
      <filter id="${shadowId}" filterUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <feDropShadow dx="0.6" dy="0.9" stdDeviation="0.5" style="flood-color: var(--gmt-ink-fixed); flood-opacity: 0.35" />
      </filter>
    </defs>
    <polygon points="${CLOCK_OUTER}" class="${styles.edge}" />
    <polygon points="${CLOCK_OUTER}" class="${styles.glow}" />
    <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${DIAL_RADIUS}" class="${styles.skipRing}" />
    ${ticks()}
    ${highlightMarkup}
    <g class="${styles.hands}" filter="url(#${shadowId})">
      ${line([CENTER_X, CENTER_Y], hourHand, styles.hand!, html`data-hand="hour"`)}
      ${line([CENTER_X, CENTER_Y], minuteHand, styles.hand!, html`data-hand="minute"`)}
      ${second === undefined ? "" : secondHand(second)}
    </g>
    ${line(
      [CENTER_X - DIAL_RADIUS * 0.7, CENTER_Y - DIAL_RADIUS * 0.7],
      [CENTER_X + DIAL_RADIUS * 0.7, CENTER_Y + DIAL_RADIUS * 0.7],
      styles.skipMark!,
    )}
    <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${CAP_RADIUS}" class="${styles.cap}" />
    <polygon points="${CLOCK_OUTER}" class="${styles.repeatRing}" />
    <g class="${styles.glass}" clip-path="url(#${clipId})">
      <polygon points="${CLOCK_OUTER}" fill="url(#${tintId})" />
      <polygon points="${CLOCK_OUTER}" fill="url(#${sheenId})" />
    </g>
  </svg>`;

  if (!glowable) return svg;
  return html`<button type="button" class="${styles.toggle}" data-clock-toggle aria-pressed="false" aria-label="${crystalClockToggleName(name)}">${svg}</button>`;
}

/**
 * Wires the night-light toggle for every face inside `root`, present or future. Delegated on
 * `root` rather than bound to the buttons: a widget redraws this markup, button included, on
 * every input, so a listener on one draw's button would be gone by the next. `signal` removes
 * the listener on abort.
 *
 * Enter and Space need no handling: a real `<button>` turns both into a `click`.
 */
export function bindClockToggle(root: HTMLElement, signal: AbortSignal): void {
  root.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-clock-toggle]");
      if (button === null || !root.contains(button)) return;
      const on = button.getAttribute("aria-pressed") === "true";
      button.setAttribute("aria-pressed", String(!on));
      const svg = button.querySelector("svg");
      svg?.setAttribute("data-glow", String(!on));
    },
    { signal },
  );
}
