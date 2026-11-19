/**
 * The 24-hour clock that stands where the Earth would be, until the slide that reveals the planet:
 * a watch dial seen from straight above the North Pole, as the camera sees the Earth. It ticks a
 * zone's wall time (`loadClock`, read by gmt) and lies on the Earth's disc: the dial's rim, 40 of
 * the face's 100 units, is the Earth's rim, so the clock takes the Earth's size and place on every
 * layout and at every zoom (`fit`, fed by the stage each frame). The ten units round the rim hold
 * only the dial's glow.
 *
 * The phase is published on the space layer as `data-earth-clock` for the stylesheet
 * (`slides.css`): `on` hides the globe behind the clock; `shatter` breaks the dial into shards that
 * fly away (`clock-shatter.ts`) while the Earth, already in its place, comes up from behind them;
 * with no phase the clock is gone. The layer also carries the disc's centre (`--gmt-earth-x`,
 * `--gmt-earth-y`), so the Earth grows from where the clock stood.
 *
 * The dial says whose time it is: the city and its UTC offset under the mark, and a calendar window
 * with the zone's weekday, day and month, all read by gmt from the same zoned string as the hands.
 * The hour hand stops short of the numerals so the hour it points at stays legible.
 *
 * The face is drawn in `earth-clock-face.ts`. A build can hold the hands at an instant (`hold`), so
 * a slide can stand the clock in the Earth's place at the minute before a zone's clocks skip, then
 * the minute after.
 *
 * Until gmt has read the time the dial has no hands and the date window and offset are blank: a
 * dial that showed a time it did not know would jump when the time came. The first time read sets
 * the hands and writes the date, and marks the face `data-timed`; the stylesheet fades the hands,
 * the date and the offset in together, already in place (none under reduced motion). A zone gmt
 * does not know leaves the dial without hands.
 */
import { shatter } from "./clock-shatter";
import { BOX, dialDate, drawEarthDial, RIM } from "./earth-clock-face";
import { loadClock } from "./title-clock";

type EarthClockPhase = "on" | "shatter" | "off";

export interface EarthClock {
  /** Sets the dial on the Earth's disc: its centre and rim radius in the layer's pixels. */
  fit(disc: { x: number; y: number; radius: number }): void;
  /** Shows the clock, breaks it away from in front of the Earth, or ends it. */
  set(phase: EarthClockPhase): void;
  /** Stops the hands at a UTC instant (`…Z`), the zone's wall time then; `null` ticks the time now again. */
  hold(utc: string | null): void;
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

  /** The shards while the clock breaks; `null` otherwise. */
  let shards: HTMLElement | null = null;
  const sweep = (): void => {
    shards?.remove();
    shards = null;
  };

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
      layer.style.setProperty("--gmt-earth-x", `${x}px`);
      layer.style.setProperty("--gmt-earth-y", `${y}px`);
    },
    set(phase) {
      if (phase !== "shatter") sweep();
      if (phase === "off") delete layer.dataset["earthClock"];
      else layer.dataset["earthClock"] = phase;
      const face = el.querySelector("svg");
      if (phase !== "shatter" || shards || !face) return;
      shards = layer.ownerDocument.createElement("div");
      shards.setAttribute("data-shards", "");
      el.append(shards);
      shatter(face, shards);
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
      sweep();
      el.remove();
      delete layer.dataset["earthClock"];
    },
    { once: true },
  );
  return clock;
}
