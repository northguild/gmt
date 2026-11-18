/**
 * The 24-hour clock that stands where the Earth would be, until the slide that reveals the planet:
 * a watch dial seen from straight above the North Pole, as the camera sees the Earth. It ticks a
 * zone's wall time (`loadClock`, read by gmt) and lies on the Earth's disc: the dial's rim, 40 of
 * the face's 100 units, is the Earth's rim, so the clock takes the Earth's size and place on every
 * layout and at every zoom (`fit`, fed by the stage each frame). The ten units round the rim hold
 * only the dial's glow.
 *
 * The phase is published on the space layer as `data-earth-clock` for the stylesheet
 * (`slides.css`): `on` hides the globe behind the clock; `morph` turns the hour indices onto the
 * meridians (`--gmt-meridian-turn`, from `meridianTurn`), clears the enamel and the glass so the
 * Earth fades in under them, draws the meridians in from the rim to the pole, then fades the rest;
 * with no phase the clock is gone. The numerals go first: on the Earth seen from above the hours
 * run clockwise and the longitudes anticlockwise, so a numeral would not name the meridian under
 * it. The hour hand stays to the end: the camera is turned so it points along the zone's meridian.
 *
 * The dial says whose time it is: the city and its UTC offset under the mark, and a calendar window
 * with the zone's weekday, day and month, all read by gmt from the same zoned string as the hands.
 * The hour hand stops short of the numerals so the hour it points at stays legible.
 *
 * A build can hold the hands at an instant (`hold`): the GMT slide stands the clock in the Earth's
 * place again at the minute before Helsinki's clocks skip, then the minute after.
 *
 * Until gmt has read the time the dial has no hands and the date window and offset are blank: a
 * dial that showed a time it did not know would jump when the time came. The first time read sets
 * the hands and writes the date, and marks the face `data-timed`; the stylesheet fades the hands,
 * the date and the offset in together, already in place (none under reduced motion). A zone gmt
 * does not know leaves the dial without hands.
 */
import type { formatZonedToParts as FormatZonedToParts } from "@northguild/gmt/zoned/format";
import { html, setHtml, type SafeHtml } from "~/widgets/builders";
import { CALENDAR_PAGE, calendarPage } from "./calendar-page";
import { loadClock } from "./title-clock";

export type EarthClockPhase = "on" | "morph" | "off";

export interface EarthClock {
  /** Sets the dial on the Earth's disc: its centre and rim radius in the layer's pixels. */
  fit(disc: { x: number; y: number; radius: number }): void;
  /** Shows the clock, turns it into the Earth (`turn` degrees clockwise onto the meridians), or ends it. */
  set(phase: EarthClockPhase, turn?: number): void;
  /** Stops the hands at a UTC instant (`…Z`), the zone's wall time then; `null` ticks the time now again. */
  hold(utc: string | null): void;
}

/** The custom property the stylesheet turns the hour indices and meridians by. */
export const MERIDIAN_TURN_VAR = "--gmt-meridian-turn";

/** The dial's rim radius in the face's 100-unit box: the Earth's rim. */
const RIM = 40;
const BOX = 100;
const C = BOX / 2;
const HOURS = 24;
/** Quarter-hour marks on the chapter ring. */
const QUARTERS = HOURS * 4;
/** Fine rays of the sunburst enamel. */
const RAYS = 120;

const coord = (n: number): string => String(Number(n.toFixed(3)));

/** The point `r` units from the centre, `deg` degrees clockwise from the top. */
function at(r: number, deg: number): [string, string] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [coord(C + r * Math.cos(rad)), coord(C + r * Math.sin(rad))];
}

/** A tapered bar from `r0` out to `r1`, `w0` wide at the inner end and `w1` at the outer. */
function bar(
  deg: number,
  r0: number,
  r1: number,
  w0: number,
  w1: number,
): string {
  // Half-widths as angles at each radius, so the bar is straight-sided.
  const a0 = ((w0 / 2 / r0) * 180) / Math.PI;
  const a1 = ((w1 / 2 / r1) * 180) / Math.PI;
  return [
    at(r0, deg - a0),
    at(r1, deg - a1),
    at(r1, deg + a1),
    at(r0, deg + a0),
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

function defs(): SafeHtml {
  return html`<defs>
    <radialGradient id="earth-clock-enamel" cx="50%" cy="46%" r="52%">
      <stop offset="0%" stop-color="var(--gmt-teal)" stop-opacity="0.5" />
      <stop offset="55%" stop-color="var(--gmt-void)" stop-opacity="0.9" />
      <stop offset="100%" stop-color="var(--gmt-void)" />
    </radialGradient>
    <linearGradient id="earth-clock-steel" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="var(--gmt-ice-bright)" />
      <stop offset="28%" stop-color="var(--gmt-ice-dim)" />
      <stop offset="52%" stop-color="var(--gmt-ice-bright)" />
      <stop offset="78%" stop-color="var(--gmt-ice-dim-fill)" />
      <stop offset="100%" stop-color="var(--gmt-ice)" />
    </linearGradient>
    <linearGradient id="earth-clock-bezel" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="var(--gmt-ice-bright)" />
      <stop offset="22%" stop-color="var(--gmt-ice-dim-fill)" />
      <stop offset="50%" stop-color="var(--gmt-void)" />
      <stop offset="74%" stop-color="var(--gmt-ice-dim)" />
      <stop offset="100%" stop-color="var(--gmt-void)" />
    </linearGradient>
    <radialGradient id="earth-clock-glass" cx="34%" cy="22%" r="70%">
      <stop offset="0%" stop-color="var(--gmt-ice-bright)" stop-opacity="0.2" />
      <stop offset="40%" stop-color="var(--gmt-ice-bright)" stop-opacity="0.05" />
      <stop offset="100%" stop-color="var(--gmt-ice-bright)" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="earth-clock-depth" cx="50%" cy="50%" r="50%">
      <stop offset="78%" stop-color="var(--gmt-void)" stop-opacity="0" />
      <stop offset="100%" stop-color="var(--gmt-void)" stop-opacity="0.7" />
    </radialGradient>
    <filter id="earth-clock-shadow" filterUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <feDropShadow dx="0.5" dy="0.9" stdDeviation="0.45" flood-color="var(--gmt-void)" flood-opacity="0.85" />
    </filter>
  </defs>`;
}

/** The enamel, the sunburst over it and the depth at its edge: what clears for the Earth. */
function dial(): SafeHtml {
  const rays = Array.from({ length: RAYS }, (_, k) => {
    const [x1, y1] = at(4, (k * 360) / RAYS);
    const [x2, y2] = at(RIM - 3.5, (k * 360) / RAYS);
    return html`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
  });
  return html`<g data-dial-face>
    <circle cx="50" cy="50" r="${String(RIM)}" fill="url(#earth-clock-enamel)" />
    <g data-sunburst>${rays}</g>
    <circle cx="50" cy="50" r="${String(RIM)}" fill="url(#earth-clock-depth)" />
  </g>`;
}

/** The chapter ring: two hairlines and a mark every quarter hour between the hour indices. */
function chapter(): SafeHtml {
  const marks = Array.from({ length: QUARTERS }, (_, k) => {
    if (k % 4 === 0) return null;
    const deg = (k * 360) / QUARTERS;
    const [x1, y1] = at(33.4, deg);
    const [x2, y2] = at(k % 2 === 0 ? 35.4 : 34.8, deg);
    return html`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
  });
  return html`<g data-chapter>
    <circle cx="50" cy="50" r="35.6" fill="none" />
    <circle cx="50" cy="50" r="33.2" fill="none" />
    ${marks}
  </g>`;
}

/**
 * The 24 applied hour indices, steel with a lume inlay, and the 24 meridians under them, in one
 * group the reveal turns. Every second hour's index is longer; the four cardinal hours are doubled.
 */
function indices(): SafeHtml {
  const marks = Array.from({ length: HOURS }, (_, h) => {
    const deg = (h * 360) / HOURS;
    const r0 = h % 2 === 0 ? 25.6 : 28.4;
    const pair = h % 6 === 0 ? [deg - 1.6, deg + 1.6] : [deg];
    return pair.map(
      (
        d,
      ) => html`<polygon points="${bar(d, r0, 32.6, 1.5, 2)}" fill="url(#earth-clock-steel)" />
        <polygon data-lume points="${bar(d, r0 + 0.9, 31.8, 0.5, 0.7)}" />`,
    );
  });
  const meridians = Array.from({ length: HOURS }, (_, k) => {
    const [x, y] = at(RIM, (k * 360) / HOURS);
    return html`<line x1="${x}" y1="${y}" x2="50" y2="50" pathLength="1" data-meridian />`;
  });
  return html`<g data-turn>
    <g data-earth-meridians>${meridians}</g>
    <g data-indices filter="url(#earth-clock-shadow)">${marks}</g>
  </g>`;
}

/** The even hours' numerals, set inside the long indices. */
function numerals(): SafeHtml {
  const marks = Array.from({ length: HOURS / 2 }, (_, k) => {
    const [x, y] = at(21.4, k * 30);
    return html`<text x="${x}" y="${y}" font-size="3.3" data-numeral>${String(k * 2).padStart(2, "0")}</text>`;
  });
  return html`<g data-numerals>${marks}</g>`;
}

function legend(city: string): SafeHtml {
  return html`<g data-legend>
    <text x="50" y="32.6" font-size="2.6" data-legend-mark>GMT</text>
    <text x="50" y="37" font-size="2" data-legend-city>${city.toUpperCase()}</text>
    <text x="50" y="39.9" font-size="1.4" data-legend-offset></text>
  </g>`;
}

/** Where the calendar window's page sits on the dial: centred, under the hub. */
const CAL_AT = { x: 50 - CALENDAR_PAGE.w / 2, y: 54.2 };

/** The calendar window: the zone's month, day and weekday, written in on each new day. */
function calendar(): SafeHtml {
  const { page, strip, month, day, weekday } = calendarPage(CAL_AT.x, CAL_AT.y);
  return html`<g data-calendar>
    <polygon points="${page}" data-calendar-page />
    <polygon points="${strip}" data-calendar-strip />
    <text x="${month.x}" y="${month.y}" font-size="${month.size}" data-calendar-month></text>
    <text x="${day.x}" y="${day.y}" font-size="${day.size}" data-calendar-day></text>
    <text x="${weekday.x}" y="${weekday.y}" font-size="${weekday.size}" data-calendar-weekday></text>
  </g>`;
}

/** What the dial writes for a zone's date and offset, read from gmt's zoned string. */
export interface DialDate {
  month: string;
  day: string;
  weekday: string;
  offset: string;
}

/**
 * The calendar window's text and the offset line for gmt's zoned string, in English capitals as the
 * dial's other words are: `formatZonedToParts` names the weekday and month, and the offset is the
 * string's own. `null` when gmt returns no parts.
 */
export function dialDate(
  zoned: string,
  format: typeof FormatZonedToParts,
): DialDate | null {
  const parts = format(zoned, "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const part = (type: string): string =>
    parts.find((p) => p.type === type)?.value.toUpperCase() ?? "";
  const offset = /([+-]\d{2}:\d{2})(?::\d{2})?\[/.exec(zoned)?.[1];
  const date = {
    month: part("month"),
    day: part("day"),
    weekday: part("weekday"),
  };
  if (!date.month || !date.day || !date.weekday || offset === undefined)
    return null;
  return { ...date, offset: `UTC${offset}` };
}

/** The hands, drawn pointing at 00 and turned by `transform`; hidden until the face is timed. */
function hands(): SafeHtml {
  return html`<g data-hands filter="url(#earth-clock-shadow)">
    <g data-hand="hour">
      <polygon points="50,32.4 51.9,37 51.4,53 50,56 48.6,53 48.1,37" fill="url(#earth-clock-steel)" />
      <polygon data-lume points="50,34.6 50.95,37.8 50.7,46 49.3,46 49.05,37.8" />
    </g>
    <g data-hand="minute">
      <polygon points="50,15 51.05,20.5 50.85,54 50,57 49.15,54 48.95,20.5" fill="url(#earth-clock-steel)" />
      <polygon data-lume points="50,17.6 50.5,21.5 50.4,40 49.6,40 49.5,21.5" />
    </g>
    <g data-hand="second">
      <line x1="50" y1="60" x2="50" y2="14.5" />
      <circle cx="50" cy="57" r="1.25" />
      <circle cx="50" cy="19" r="0.95" data-second-tip />
    </g>
    <circle cx="50" cy="50" r="1.9" fill="url(#earth-clock-steel)" />
    <circle cx="50" cy="50" r="0.7" data-cap />
  </g>`;
}

/** The glass dome inside the bezel, and the bezel on the Earth's rim. */
function bezel(): SafeHtml {
  return html`<g data-glass>
    <circle cx="50" cy="50" r="${String(RIM - 3)}" fill="url(#earth-clock-glass)" />
    <path d="M 27.5 30 A 30 30 0 0 1 56 19.6 A 32 32 0 0 0 27.5 30 Z" data-glint />
  </g>
  <circle cx="50" cy="50" r="${String(RIM - 1.4)}" fill="none" stroke="url(#earth-clock-bezel)" stroke-width="2.8" data-bezel />
  <circle cx="50" cy="50" r="${String(RIM - 3)}" fill="none" data-bezel-edge />`;
}

/** The face for a city, drawn once; each tick only turns the hands. */
function face(city: string): SafeHtml {
  return html`<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    ${defs()}${dial()}${chapter()}${indices()}${numerals()}${legend(city)}${calendar()}${hands()}${bezel()}
  </svg>`;
}

/** A wall time as the hands show it. */
export interface DialTime {
  hour: number;
  minute: number;
  second: number;
}

/** Each hand's angle, degrees clockwise from 00, on a dial the hour hand goes round once a day. */
export function handAngles(t: DialTime): DialTime {
  return {
    hour: (t.hour * 60 + t.minute + t.second / 60) / 4,
    minute: (t.minute + t.second / 60) * 6,
    second: t.second * 6,
  };
}

/** A drawn dial: `show` turns the hands to a time and writes its date, when there is one. */
interface EarthDial {
  show(t: DialTime, date: DialDate | null): void;
}

/**
 * Draws the dial for `city` into `el`, with no time: the hands hidden and the date blank. The face
 * is drawn once: `show` only turns the hands and rewrites the date when it changes.
 */
function drawEarthDial(el: HTMLElement, city: string): EarthDial {
  setHtml(el, face(city));
  let written = "";
  const writeDate = (date: DialDate): void => {
    const key = `${date.weekday} ${date.day} ${date.month} ${date.offset}`;
    if (key === written) return;
    written = key;
    const text = (hook: string, value: string): void => {
      const node = el.querySelector(`[${hook}]`);
      if (node) node.textContent = value;
    };
    text("data-calendar-month", date.month);
    text("data-calendar-day", date.day);
    text("data-calendar-weekday", date.weekday);
    text("data-legend-offset", date.offset);
  };
  return {
    show(t, date) {
      if (date !== null) writeDate(date);
      const angles = handAngles(t);
      for (const name of ["hour", "minute", "second"] as const) {
        el.querySelector(`[data-hand="${name}"]`)?.setAttribute(
          "transform",
          `rotate(${coord(angles[name])} 50 50)`,
        );
      }
      el.setAttribute("data-timed", "");
    },
  };
}

/** Puts the clock in `layer` (the deck's space layer). Aborting `signal` takes it away. */
export function mountEarthClock(
  layer: HTMLElement,
  o: { signal: AbortSignal; zone: string; city: string },
): EarthClock {
  const el = layer.ownerDocument.createElement("div");
  el.className = "gmt-earth-clock";
  el.setAttribute("data-earth-clock-face", "");
  const dial = drawEarthDial(el, o.city);
  layer.append(el);

  let timer: ReturnType<typeof setTimeout> | undefined;
  /** The instant the hands are held at; `null` while they tick. */
  let held: string | null = null;
  /** Shows the held or the current time; set once gmt has loaded. */
  let redraw: (() => void) | null = null;
  const format = import("@northguild/gmt/zoned/format").then(
    (m) => m.formatZonedToParts,
    () => null,
  );
  void Promise.all([loadClock(o.zone), format]).then(([time, parts]) => {
    if (time === null || o.signal.aborted) return;
    const tick = (): void => {
      clearTimeout(timer);
      if (o.signal.aborted) return;
      const t = held === null ? time.read() : time.at(held);
      // No time is gmt's sentinel for a zone it does not know: the dial keeps no hands.
      if (t === null) return;
      dial.show(t, parts === null ? null : dialDate(t.zoned, parts));
      // A held time does not move, so only the time now waits for the next second.
      if (held === null) timer = setTimeout(tick, time.untilNextSecond());
    };
    redraw = tick;
    tick();
  });

  let fitted = "";
  const clock: EarthClock = {
    fit({ x, y, radius }) {
      const size = (radius * BOX) / RIM;
      const key = `${size.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      if (key === fitted) return;
      fitted = key;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
    },
    set(phase, turn = 0) {
      if (phase === "off") delete layer.dataset["earthClock"];
      else layer.dataset["earthClock"] = phase;
      el.style.setProperty(MERIDIAN_TURN_VAR, `${turn}deg`);
    },
    hold(utc) {
      if (utc === held) return;
      held = utc;
      redraw?.();
    },
  };
  o.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
      el.remove();
      delete layer.dataset["earthClock"];
    },
    { once: true },
  );
  return clock;
}
