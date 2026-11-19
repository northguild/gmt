/**
 * The space stage's filing pins: a slide that sets `data-pins="filings"` lights every upstream
 * filing as a pin on the zone it names and runs the count up (`filing-pins.ts`). Opt-in: a page
 * with no `[data-filing-steps]` has no steps, so turning it on shows nothing.
 *
 * The count waits `FILINGS_DELAY_MS` for the flight to the overview to settle. Under reduced
 * motion it runs at once and ends at once.
 */
import { prefersReducedMotion } from "~/lib/reduced-motion";
import {
  decodeSteps,
  pinsAfter,
  runCount,
  type FilingStep,
} from "./filing-pins";
import { isGeographic, resolvePlace, type PlacePoint } from "./places";
import { showText } from "./type-out";

/** The count waits this long for the flight to the overview to settle, milliseconds. */
const FILINGS_DELAY_MS = 2200;

interface FilingsDeps {
  root: HTMLElement;
  host: HTMLElement | null;
  win: Window | null;
  /** Redraws the pins after the counts changed. */
  draw(): void;
}

interface StageFilings {
  /** The zones the filings name, as points, for the overview to centre on. */
  points: readonly PlacePoint[];
  /** Zones lit for the filing pins, with the filings each holds so far. */
  counts(): ReadonlyMap<string, number>;
  /** Lights the filings as pins and runs the count up, or clears them. */
  set(on: boolean): void;
  stop(): void;
}

export function createFilings(d: FilingsDeps): StageFilings {
  const { root, host, win } = d;
  const steps: FilingStep[] = decodeSteps(
    root.querySelector<HTMLElement>("[data-filing-steps]")?.dataset[
      "filingSteps"
    ] ?? "",
  );
  const points: PlacePoint[] = steps.flatMap((s) => {
    if (s.zone === null) return [];
    try {
      const place = resolvePlace(s.zone);
      return isGeographic(place) ? [[place.lng, place.lat] as const] : [];
    } catch {
      return [];
    }
  });
  let counts = new Map<string, number>();
  let on = false;
  let stopCount: (() => void) | null = null;
  let timer = 0;

  function stop(): void {
    stopCount?.();
    stopCount = null;
    if (timer) win?.clearTimeout(timer);
    timer = 0;
  }

  function set(next: boolean): void {
    if (next === on) return;
    on = next;
    stop();
    const total = steps.length;
    const output = root.querySelector<HTMLElement>("[data-filing-count]");
    // One digit per flap: a count shorter than the total leaves its leading flaps blank.
    const show = (n: number): void => {
      if (output)
        showText(output, String(n).padStart(String(total).length, " "));
    };
    if (!next || total === 0 || !win) {
      counts = new Map();
      show(total);
      if (host) delete host.dataset["filings"];
      d.draw();
      return;
    }
    const start = (): void => {
      timer = 0;
      stopCount = runCount({
        total,
        win,
        reduced: prefersReducedMotion(win),
        onStep: (n) => {
          counts = pinsAfter(steps, n);
          show(n);
          if (host) host.dataset["filings"] = String(n);
          d.draw();
        },
      });
    };
    show(0);
    if (prefersReducedMotion(win)) start();
    else timer = win.setTimeout(start, FILINGS_DELAY_MS);
  }

  return { points, counts: () => counts, set, stop };
}
