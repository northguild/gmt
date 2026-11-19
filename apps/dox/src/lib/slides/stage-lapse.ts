/**
 * The space stage's time-lapses (`time-lapse.ts` holds the maths): on a slide or build that names a
 * `lapse` the camera holds still and the sun runs across the Earth, and the lapse's pins carry
 * their own local dates. Opt-in: a deck with no `lapses` in its stage data never calls `set`, and
 * the sun then stands at now.
 *
 * This owns the sun's instant on screen (`shownSun`), the running lapse and the glide that carries
 * the sun from where it stood to where the next section puts it (`sun-glide.ts`). The stage tells
 * it when to redraw; it tells the deck root what runs (`data-lapse` on the space layer and the
 * `gmt-lapse` event, which the slides' own visuals play from).
 */
import type { GlobeEngine } from "~/lib/globe/types";
import { prefersReducedMotion } from "~/lib/reduced-motion";
import { foldYears, runSunGlide } from "./sun-glide";
import {
  dateOf,
  isDayLong,
  lapseEndMs,
  planLapse,
  runLapse,
  type LapseDef,
  type LapseFrame,
  type LapseTools,
} from "./time-lapse";

interface LapseDeps {
  root: HTMLElement;
  host: HTMLElement | null;
  win: Window | null;
  /** The lapses a slide may name, by name. */
  defs: Readonly<Record<string, LapseDef>>;
  /** Epoch milliseconds now, from gmt; 0 until gmt is in. */
  now(): number;
  engine(): GlobeEngine | null;
  /** Redraws the pins after the lapse's zones or dates changed. */
  draw(): void;
}

interface StageLapse {
  /** The instant the sun, the night side, the sky and the Moon show. */
  shownSun(): number;
  /** The lapse playing, or `null` when the sun runs at now. */
  active(): string | null;
  /** The zones the playing lapse dates, and the local stamp each one shows. */
  zones(): readonly string[];
  stamps(): Readonly<Record<string, string>>;
  /** Hands over gmt's tools once they are in, so a lapse can be planned. */
  setTools(tools: LapseTools): void;
  /**
   * The instant the Moon is placed at for a slide that names `name`: where that lapse stops, when
   * it has a fixed end (the new moon), so a flight lands where the Moon will stand; otherwise the
   * sun's instant.
   */
  moonInstant(name: string | null): number;
  /** Asks for a lapse (or `null` for the sun at now) and starts it as soon as gmt is in. */
  set(name: string | null): void;
  /** Starts the wanted lapse, or puts the sun back to now; the stage calls it when gmt arrives. */
  apply(): void;
  stop(): void;
}

export function createLapse(d: LapseDeps): StageLapse {
  const { root, host, win } = d;
  /** The sun's speed while a lapse plays, in sun milliseconds per stage millisecond. */
  let sunRate = 0;
  /** The sun's instant while a lapse plays or holds its end; `null` is now. */
  let sunMs: number | null = null;
  /** How far the sun on screen still stands off its timeline while it glides there. */
  let sunOffset = 0;
  let glideStop: (() => void) | null = null;
  let tools: LapseTools | null = null;
  let wanted: string | null = null;
  let active: string | null = null;
  let activeDef: LapseDef | null = null;
  let stopRun: (() => void) | null = null;
  let zones: readonly string[] = [];
  let stamps: Readonly<Record<string, string>> = {};

  const shownSun = (): number => (sunMs ?? d.now()) + sunOffset;
  const defOf = (name: string | null): LapseDef | null =>
    name !== null && Object.hasOwn(d.defs, name) ? d.defs[name]! : null;

  /** Publishes the lapse for the deck's gate and for the slides' own visuals. */
  function publish(name: string | null, frame: LapseFrame | null): void {
    if (host) {
      if (name) host.dataset["lapse"] = name;
      else delete host.dataset["lapse"];
    }
    if (name && frame)
      root.dispatchEvent(
        new CustomEvent("gmt-lapse", {
          detail: {
            name,
            ms: frame.ms,
            done: frame.done,
            dates: Object.fromEntries(
              Object.entries(frame.stamps).map(([zone, stamp]) => [
                zone,
                dateOf(stamp),
              ]),
            ),
          },
        }),
      );
  }

  function stopLapse(): void {
    stopRun?.();
    stopRun = null;
  }

  function stopGlide(): void {
    glideStop?.();
    glideStop = null;
    sunOffset = 0;
  }

  /**
   * Glides the sun from the instant `from`, on screen, to the timeline now in place. Under reduced
   * motion, or before the Earth is drawn, it cuts.
   */
  function glideFrom(from: number): void {
    stopGlide();
    const startMs = foldYears(from - shownSun());
    if (!d.engine() || !win || prefersReducedMotion(win) || startMs === 0)
      return;
    glideStop = runSunGlide({
      startMs,
      win,
      onFrame: (offset) => {
        sunOffset = offset;
        d.engine()?.requestRender();
      },
    });
  }

  function apply(): void {
    if (wanted === active) return;
    const from = shownSun();
    // A day-long lapse after a day-long lapse carries on from the sun on screen, at its speed.
    const carry =
      activeDef !== null && isDayLong(activeDef)
        ? { ms: from, rate: sunOffset === 0 ? sunRate : 0 }
        : null;
    stopLapse();
    active = null;
    activeDef = null;
    zones = [];
    stamps = {};
    sunMs = null;
    sunRate = 0;
    publish(null, null);
    const name = wanted;
    const def = defOf(name);
    const plan =
      name !== null && def !== null && tools
        ? planLapse(name, def, tools, isDayLong(def) ? carry : null)
        : null;
    if (plan === null || tools === null) {
      glideFrom(from);
      d.engine()?.requestRender();
      d.draw();
      return;
    }
    const run = tools;
    // The glide measures from the lapse's first instant, which `runLapse` shows first.
    sunMs = plan.fromMs;
    glideFrom(from);
    active = name;
    activeDef = def;
    zones = plan.zones;
    let seen = "";
    stopRun = runLapse({
      plan,
      tools: run,
      win: win ?? {
        requestAnimationFrame: () => 0,
        cancelAnimationFrame: () => {},
      },
      reduced: prefersReducedMotion(win ?? {}),
      onFrame: (frame) => {
        sunMs = frame.ms;
        sunRate = frame.rate;
        stamps = frame.stamps;
        const key = JSON.stringify(frame.stamps);
        if (key !== seen || frame.done) {
          seen = key;
          publish(name, frame);
          d.draw();
        }
        d.engine()?.requestRender();
      },
    });
  }

  return {
    shownSun,
    active: () => active,
    zones: () => zones,
    stamps: () => stamps,
    setTools: (next) => {
      tools = next;
    },
    moonInstant: (name) => {
      const def = defOf(name);
      if (def && tools) {
        const end = lapseEndMs(def, tools);
        if (end !== null) return end;
      }
      return shownSun();
    },
    set: (name) => {
      wanted = name;
      apply();
    },
    apply,
    stop: () => {
      stopLapse();
      stopGlide();
    },
  };
}
