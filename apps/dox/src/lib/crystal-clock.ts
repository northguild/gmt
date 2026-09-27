/**
 * A shared, reusable analog clock: a thin 12-sided (dodecagon) outline
 * around a dial, with hour and minute hands, a small centre cap, and a
 * clear ice-glass pane over the whole face.
 *
 * This is *not* a Dox-mark treatment shrunk to clock size. The mark's
 * six-sided crystal — its inner facet ring, its spokes, its gradient face —
 * is reserved for the mark; a clock borrowing that silhouette read as a
 * clone of the logo, not an instrument. The only thing this face shares
 * with the house style is the polygon outline itself (a hairline, single
 * stroke, 12 sides so each side sits under one hour position — see
 * `vertexAngle` below) and the site's own ice-glass material
 * (`--gmt-glass-tint`, `--gmt-glass-tint-subtle`, `--gmt-ice`, `--gmt-teal`
 * — the same tokens `gmt-glass.css` / `gmt-primitives.css` build panels
 * from), applied as a clear pane over the dial rather than a solid fill.
 * Everything else — the dial, the ticks, the hands — is drawn plain, with
 * generous negative space, the way a precise instrument is drawn rather
 * than a badge. (Owner review, three passes: "not a Dox-mark clone, thinner
 * frame, more open dial"; then "add a restrained ice-glass pane, slightly
 * toward realism — a curved sheen, a soft hand shadow, never a
 * skeuomorphic render"; then "the sheen read as a floating bubble — it has
 * to reach the frame on every side, clipped to the dodecagon, with nothing
 * else drawn outside it.")
 *
 * Follows `dox-mark.ts`'s approach in one respect: pure geometry plus an
 * SVG-string renderer, no framework, so a widget's mount can drop the
 * markup straight into `innerHTML`. First adopted by the Crossing Clock
 * (TRAN-9); written so the Connection Checker, the Timetable Reader and the
 * DST Inspector can adopt the same face later.
 *
 * The caller resolves the wall-clock hour and minute from gmt/Temporal
 * first (`crossingClockFace` in `crossing-clock.ts` is the Crossing Clock's
 * own reader for `crossingTime`'s zoned strings). This module only turns an
 * hour and a minute into hand angles and markup — it never reads a clock,
 * a zone or a duration itself.
 *
 * Every colour is a token, applied by `gmt-crystal-clock.css`; `state`
 * selects a stylesheet modifier class, never a literal here. The one
 * exception on the geometry side is the glass pane's gradients, clip path
 * and drop-shadow filter, which must be **inline `<defs>`**, not CSS: SVG
 * gradients/clip-paths/filters live in markup, referenced by `url(#id)`,
 * and each id is suffixed with the caller's `id` so two clocks on one page
 * (Entry and Exit) never collide — the same trap `HiveGlyph.tsx` documents
 * for the Dox mark's own gradients.
 *
 * **The night light.** A small easter egg (owner ask): clicking or tapping
 * a clock toggles a glow, like the backlight on a digital watch — never
 * named after a specific trademarked feature, in code, comments or UI text.
 * `glowable` (on by default) wraps the face in a real `<button
 * type="button">` carrying `aria-pressed`, so Enter/Space toggle it for
 * free; `bindClockGlow` wires the click with event delegation, because a
 * widget's `render()` replaces this markup — including the button itself —
 * on every input change, so a listener bound to one render's button would
 * be gone by the next. It is pure presentation: no value, permalink or chat
 * argument is touched, and a fresh render starts un-glowed (the widget
 * never tries to remember it across a preset change or a re-render, which
 * would need to thread glow state through every caller for a purely
 * decorative toggle).
 *
 * **The highlight.** `highlight` draws one affected wall-clock hour as a
 * sector between the tick ring and the centre — `skipped` a single dashed
 * pie-wedge outline, `repeated` two concentric solid arcs, so the two read
 * apart by shape even before colour. The caller supplies the hour/minute
 * pair a real DST-transition search already found (`crossing-clock.ts`'s
 * `crossingChanges`); this module only turns it into an angle and a path.
 */
import { escapeAttr, escapeHtml } from "./widget-ui";

/** Square viewBox — a dodecagon is near-circular. */
export const CLOCK_VIEWBOX = "0 0 100 100";

const CENTER_X = 50;
const CENTER_Y = 50;

const VERTEX_COUNT = 12;

/** The bezel outline. Close to the viewBox edge: the frame is a hairline,
 *  not a heavy ring, so it can sit almost at the boundary. */
const OUTER_RADIUS = 46;

/** The tick ring's own outer radius — a small inset from the bezel, not the
 *  wide margin a faceted ring would need. The dial fills nearly the whole
 *  shape. */
const DIAL_RADIUS = 40;

const TICK_MINOR_LENGTH = 3;
const TICK_MAJOR_LENGTH = 6;

/** The minute hand is the longer, thinner of the two — its weight is set in
 *  `gmt-crystal-clock.css`, not here. */
const HOUR_HAND_LENGTH = DIAL_RADIUS * 0.45;
const MINUTE_HAND_LENGTH = DIAL_RADIUS * 0.8;

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
 * Vertex `i`'s angle (degrees clockwise from 12), `i` 0–11. Offset by 15°
 * from the hour angles (`i × 30`) rather than sitting on them: that puts a
 * **flat side**, not a point, at each hour position, so the outline's edge
 * centres under that hour's tick rather than poking a corner into it.
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

/** The bezel outline: a regular dodecagon, 12 vertices. Also the glass
 *  pane's own silhouette — both glass layers are painted on a copy of this
 *  same polygon (never a separate, smaller shape), so the ice reaches every
 *  edge of the frame with nothing floating inside it. */
export const CLOCK_OUTER: string = polygonPoints(OUTER_RADIUS);

export type CrystalClockState = "normal" | "repeated" | "skipped" | "naive";

/**
 * One wall-clock hour drawn as a sector on the dial, between the tick ring
 * and the centre — the same range a `CrossingChangeMarker` names. Every
 * field is copied out of a real DST-transition search (`getTimeZoneTransition`
 * plus the offsets either side of it — see `crossing-clock.ts`'s
 * `crossingChanges`), never chosen per preset.
 */
export interface CrystalClockHighlight {
  fromHour: number;
  fromMinute: number;
  toHour: number;
  toMinute: number;
  /** Shape carries the meaning, not colour alone: `skipped` draws one
   *  dashed wedge outline; `repeated` draws two concentric solid arcs. */
  kind: "skipped" | "repeated";
}

export interface CrystalClockOptions {
  /** Unique per instance on a page. Every gradient, clip-path and filter id
   *  this face defines is suffixed with it, so two clocks side by side
   *  never reuse each other's glass. */
  id: string;
  /** 0–23, the wall-clock hour the caller already resolved. */
  hour: number;
  /** 0–59. */
  minute: number;
  /** The accessible name's subject, e.g. "Entry clock". */
  label: string;
  /** Appended to `label` (comma-joined) for the accessible name, e.g.
   *  "01:30, minus 04:00, New York". Spell out the sign in prose — a screen
   *  reader may skip or mis-speak a bare minus sign. */
  sublabel?: string;
  state?: CrystalClockState;
  /** Pixel width; height follows the square box. Omitted, the stylesheet
   *  sizes it (`.gmt-crystal-clock { width: 100%; }`), which is what lets
   *  it shrink in a narrow container. */
  size?: number;
  /** Wrap the face in a toggle `<button>` for the night-light easter egg.
   *  Default `true`; pass `false` for a purely static, non-interactive
   *  rendering (the plain `<svg role="img">`, as before). */
  glowable?: boolean;
  /** Draws the affected hour as a sector on the dial, and folds its own
   *  label into the accessible name (see `CrystalClockHighlight`). */
  highlight?: CrystalClockHighlight;
}

export interface HandAngles {
  /** Degrees clockwise from 12 o'clock, 0–360. */
  hourDeg: number;
  minuteDeg: number;
}

/**
 * The hour and minute hand angles for a wall-clock reading, clockwise from
 * 12 at 0°. Pure trigonometry on the caller's own hour and minute — no
 * clock read, no zone, no DST, and a 24-hour `hour` folds onto the same
 * 12-hour face a real clock has.
 */
export function handAngles(hour: number, minute: number): HandAngles {
  const twelveHour = (hour % 12) + minute / 60;
  return {
    hourDeg: (twelveHour / 12) * 360,
    minuteDeg: (minute / 60) * 360,
  };
}

function svgLine(
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
  cls: string,
): string {
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" class="${cls}" />`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function wallLabel(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** The angle an hour-and-minute reading sits at on the 12-hour face —
 *  exactly the hour hand's own formula, reused so a highlight's edges line
 *  up with where an hour hand pointing at that reading would sit. */
function hourMarkAngle(hour: number, minute: number): number {
  return handAngles(hour, minute).hourDeg;
}

/** `M cx cy L p1 A r r 0 flag 1 p2 Z` — a filled-or-not pie-wedge outline
 *  from the centre out to `radius`, sweeping clockwise from `fromDeg` to
 *  `toDeg`. Every highlight this module draws is well under 180°, but the
 *  large-arc flag is still computed rather than assumed. */
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

/** Just the curved edge at `radius`, no radii to the centre — two of these
 *  at different radii are the "repeated" highlight's concentric arcs. */
function arcOnlyPath(radius: number, fromDeg: number, toDeg: number): string {
  const [x1, y1] = polar(radius, fromDeg);
  const [x2, y2] = polar(radius, toDeg);
  const delta = (((toDeg - fromDeg) % 360) + 360) % 360;
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${fmt(x1)} ${fmt(y1)} A ${fmt(radius)} ${fmt(radius)} 0 ${largeArc} 1 ${fmt(x2)} ${fmt(y2)}`;
}

/** The affected hour, as a label ("02:00–03:00 never shown") and as the
 *  dial sector(s) it draws: one dashed pie-wedge outline for `skipped`, two
 *  concentric solid arcs for `repeated` — shape carries the distinction,
 *  never colour alone. Drawn between the tick ring and the centre, above
 *  the ticks but below the hands, so the hands still read cleanly over it. */
function highlightMarkupAndLabel(
  highlight: CrystalClockHighlight | undefined,
): { markup: string; label: string | undefined } {
  if (!highlight) return { markup: "", label: undefined };
  const { fromHour, fromMinute, toHour, toMinute, kind } = highlight;
  const fromDeg = hourMarkAngle(fromHour, fromMinute);
  const toDeg = hourMarkAngle(toHour, toMinute);
  const label =
    kind === "skipped"
      ? `${wallLabel(fromHour, fromMinute)}–${wallLabel(toHour, toMinute)} never shown`
      : `${wallLabel(fromHour, fromMinute)}–${wallLabel(toHour, toMinute)} shown twice`;
  const radius = DIAL_RADIUS - 1;
  const titleTag = `<title>${escapeHtml(label)}</title>`;
  const markup =
    kind === "skipped"
      ? `<path d="${sectorOutlinePath(radius, fromDeg, toDeg)}" class="gmt-crystal-clock-highlight gmt-crystal-clock-highlight--skipped">${titleTag}</path>`
      : `<path d="${arcOnlyPath(radius, fromDeg, toDeg)}" class="gmt-crystal-clock-highlight gmt-crystal-clock-highlight--repeated">${titleTag}</path>` +
        `<path d="${arcOnlyPath(radius - 4, fromDeg, toDeg)}" class="gmt-crystal-clock-highlight gmt-crystal-clock-highlight--repeated">${titleTag}</path>`;
  return { markup, label };
}

function ticksMarkup(): string {
  const parts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const deg = i * 30;
    const major = i % 3 === 0; // 12, 3, 6, 9
    const outer = polar(DIAL_RADIUS, deg);
    const inner = polar(
      DIAL_RADIUS - (major ? TICK_MAJOR_LENGTH : TICK_MINOR_LENGTH),
      deg,
    );
    parts.push(
      svgLine(
        outer,
        inner,
        `gmt-crystal-clock-tick${major ? " gmt-crystal-clock-tick--major" : ""}`,
      ),
    );
  }
  return parts.join("");
}

/**
 * Render a crystal clock as an `<svg>` string: a hairline dodecagon outline
 * around a dial — 12 hour ticks (heavier at 12/3/6/9), a slim hour hand, a
 * slimmer, longer minute hand, a small centre cap, and a clear ice-glass
 * pane over the whole face (a soft curved sheen from the upper-left frame
 * edge, a faint darker falloff toward the lower edge — both painted edge to
 * edge on the bezel's own shape, never a separate floating shape). The
 * hands cast a very soft, tiny shadow onto the dial, so they read as
 * sitting between the dial and the glass.
 *
 * The markup is the same shape regardless of `state`: a repeat ring, a
 * skip ring and a skip-strike line are always drawn, and
 * `gmt-crystal-clock.css`'s `--repeated` / `--skipped` / `--naive`
 * modifiers are what show or mute them. That keeps this function a pure
 * function of its inputs and the visual language entirely in the
 * stylesheet — apart from the glass's own gradients/clip/filter, which
 * have to live in this markup (see the module doc). The same is true of
 * the night-light glow: a `.gmt-crystal-clock-glow` layer is always drawn,
 * `gmt-crystal-clock.css` starts it transparent, and `bindClockGlow` is
 * what turns it on.
 */
export function renderCrystalClock(opts: CrystalClockOptions): string {
  const {
    id,
    hour,
    minute,
    label,
    sublabel,
    state = "normal",
    size,
    glowable = true,
    highlight,
  } = opts;
  const { hourDeg, minuteDeg } = handAngles(hour, minute);
  const hourHand = polar(HOUR_HAND_LENGTH, hourDeg);
  const minuteHand = polar(MINUTE_HAND_LENGTH, minuteDeg);
  const { markup: highlightMarkup, label: highlightLabel } =
    highlightMarkupAndLabel(highlight);

  const uid = escapeAttr(id);
  const clipId = `gmt-crystal-clip-${uid}`;
  const tintId = `gmt-crystal-tint-${uid}`;
  const sheenId = `gmt-crystal-sheen-${uid}`;
  const shadowId = `gmt-crystal-shadow-${uid}`;

  const accessibleName = [
    sublabel ? `${label}, ${sublabel}` : label,
    highlightLabel,
  ]
    .filter((part): part is string => Boolean(part))
    .join(". ");
  const sizeAttr =
    size !== undefined ? ` width="${fmt(size)}" height="${fmt(size)}"` : "";
  // Wrapped in a toggle button, the svg is purely decorative — the button
  // carries the one accessible name and the pressed state — so it drops
  // its own role/label in favour of aria-hidden.
  const svgA11yAttrs = glowable
    ? ` aria-hidden="true"`
    : ` role="img" aria-label="${escapeAttr(accessibleName)}"`;

  const svg =
    `<svg class="gmt-crystal-clock gmt-crystal-clock--${state}" data-state="${state}" data-clock-id="${uid}" viewBox="${CLOCK_VIEWBOX}"${sizeAttr}${svgA11yAttrs} focusable="false">` +
    `<defs>` +
    `<clipPath id="${clipId}"><polygon points="${CLOCK_OUTER}" /></clipPath>` +
    // A quiet vertical wash: a touch of ice brightness up top, the house
    // glass tint through the middle, a faint teal falloff toward the
    // bottom — depth, not a coloured pane.
    `<linearGradient id="${tintId}" x1="0.5" y1="0" x2="0.5" y2="1">` +
    `<stop offset="0%" stop-color="var(--gmt-ice)" stop-opacity="0.09" />` +
    `<stop offset="42%" stop-color="var(--gmt-glass-tint-subtle)" />` +
    `<stop offset="100%" stop-color="var(--gmt-teal)" stop-opacity="0.1" />` +
    `</linearGradient>` +
    // The curved highlight: centred just above the frame's own top-left
    // edge (`cy` sits at the boundary, not inside it) and painted on a copy
    // of the *whole* bezel polygon below, so it reaches every edge and
    // fades out before its own circle would otherwise draw a visible rim —
    // light across the glass, not a bubble floating on it.
    `<radialGradient id="${sheenId}" cx="30%" cy="4%" r="85%">` +
    `<stop offset="0%" stop-color="var(--gmt-ice)" stop-opacity="0.22" />` +
    `<stop offset="35%" stop-color="var(--gmt-ice)" stop-opacity="0.08" />` +
    `<stop offset="70%" stop-color="var(--gmt-ice)" stop-opacity="0.02" />` +
    `<stop offset="100%" stop-color="var(--gmt-ice)" stop-opacity="0" />` +
    `</radialGradient>` +
    // The hands' own soft shadow onto the dial beneath them — small enough
    // to read as depth, not a graphic. `filterUnits="userSpaceOnUse"` with
    // an explicit region is load-bearing: the default objectBoundingBox
    // sizes the filter region from the *filtered group's own bounding
    // box*, and at 00:00, 06:00, 12:00 and 18:00 the hour and minute hands
    // are exactly collinear, so that box has zero width or height — an
    // empty filter region, which renders the whole group as nothing (bug
    // found by the owner: the entry clock at 00:00 showed no hands at
    // all). A region pinned to the viewBox never depends on the hands'
    // own geometry.
    `<filter id="${shadowId}" filterUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">` +
    `<feDropShadow dx="0.6" dy="0.9" stdDeviation="0.5" style="flood-color:var(--gmt-ink-fixed);flood-opacity:0.35" />` +
    `</filter>` +
    `</defs>` +
    `<polygon points="${CLOCK_OUTER}" class="gmt-crystal-clock-edge" />` +
    // The night light's own flood — transparent until `bindClockGlow`
    // toggles `.gmt-crystal-clock--glow` on the root, painted before the
    // ticks/hands so it reads as the face lighting up behind them.
    `<polygon points="${CLOCK_OUTER}" class="gmt-crystal-clock-glow" />` +
    `<circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${DIAL_RADIUS}" class="gmt-crystal-clock-skip-ring" />` +
    ticksMarkup() +
    // Between the tick ring and the centre, above the ticks but below the
    // hands — the affected hour reads as part of the dial, and the hands
    // still draw cleanly over it.
    highlightMarkup +
    `<g class="gmt-crystal-clock-hands" filter="url(#${shadowId})">` +
    svgLine(
      [CENTER_X, CENTER_Y],
      hourHand,
      "gmt-crystal-clock-hand gmt-crystal-clock-hand--hour",
    ) +
    svgLine(
      [CENTER_X, CENTER_Y],
      minuteHand,
      "gmt-crystal-clock-hand gmt-crystal-clock-hand--minute",
    ) +
    `</g>` +
    svgLine(
      [CENTER_X - DIAL_RADIUS * 0.7, CENTER_Y - DIAL_RADIUS * 0.7],
      [CENTER_X + DIAL_RADIUS * 0.7, CENTER_Y + DIAL_RADIUS * 0.7],
      "gmt-crystal-clock-skip-mark",
    ) +
    `<circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${CAP_RADIUS}" class="gmt-crystal-clock-cap" />` +
    `<polygon points="${CLOCK_OUTER}" class="gmt-crystal-clock-repeat-ring" />` +
    `<g class="gmt-crystal-clock-glass" clip-path="url(#${clipId})">` +
    `<polygon points="${CLOCK_OUTER}" class="gmt-crystal-clock-glass-tint" fill="url(#${tintId})" />` +
    `<polygon points="${CLOCK_OUTER}" class="gmt-crystal-clock-glass-sheen" fill="url(#${sheenId})" />` +
    `</g>` +
    `</svg>`;

  if (!glowable) return svg;

  return (
    `<button type="button" class="gmt-crystal-clock-toggle" aria-pressed="false" aria-label="${escapeAttr(`${accessibleName}. Light up the face.`)}">` +
    svg +
    `</button>`
  );
}

/**
 * Wires the night-light toggle for every `.gmt-crystal-clock-toggle`
 * inside `root`, present or future. Delegated on `root` rather than bound
 * to the buttons directly: a widget's `render()` replaces this markup —
 * button included — on every input change or preset switch, so a listener
 * on one render's button would already be gone by the next; delegation on
 * the stable host element survives every re-render. `signal` removes the
 * listener on abort, matching the widget's own teardown.
 *
 * Enter and Space need no handling here — a real `<button>` already turns
 * both into a `click`, which is all this listens for.
 */
export function bindClockGlow(root: HTMLElement, signal: AbortSignal): void {
  root.addEventListener(
    "click",
    (event) => {
      const button = (event.target as HTMLElement).closest(
        ".gmt-crystal-clock-toggle",
      );
      if (!button || !root.contains(button)) return;
      const svg = button.querySelector<SVGElement>("svg.gmt-crystal-clock");
      const on = button.getAttribute("aria-pressed") === "true";
      button.setAttribute("aria-pressed", on ? "false" : "true");
      svg?.classList.toggle("gmt-crystal-clock--glow", !on);
    },
    { signal },
  );
}
