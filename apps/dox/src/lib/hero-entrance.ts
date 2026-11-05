/**
 * The sequencer of the landing hero's entrance: the only thing that starts it, and the only
 * owner of its clock.
 *
 * `t0` is the moment the sky's first draw is done and the globe is ready to dawn, but no later
 * than `deadline` ms after navigation start. At `t0` it sets `data-entrance="run"` on `<html>`,
 * which the CSS entrance animations (`gmt-entrance-freeze.css`) of the sky, the buttons, the pager,
 * the header and the location card are keyed on, so they start in the same style recalculation.
 * The copy does not wait for `t0`: its freeze starts at the first paint, so the page's largest text
 * is on screen at once. If the failsafe has shown the page already (`static`), the attribute stays
 * and only the dawn starts. It also marks `gmt-entrance-t0`, starts the globe's dawn and, once the
 * last animation has ended, sets `done`. A sky or globe that failed to load counts as ready: the
 * entrance never waits on something that will not come.
 */

export interface HeroEntranceOptions {
  /** Resolves when the sky has drawn for the first time. */
  sky: { ready: Promise<void> };
  /** `ready` resolves when the globe can dawn; `startDawn` begins its ramp. */
  globe: { ready: Promise<void>; startDawn(): void };
  /** Aborting clears the timer and stops the entrance from starting. */
  signal: AbortSignal;
  /** Milliseconds after navigation start by which the entrance runs whatever is late. Default 800. */
  deadline?: number;
  /** Milliseconds since navigation start; `performance.now()` by default. */
  now?: () => number;
}

const DEFAULT_DEADLINE_MS = 800;

/** After `run`, the last animation (the location card, 2.65 s) has ended; the page is at rest. */
export const ENTRANCE_MS = 3000;

/** The performance mark that stamps `t0`, for the gates and the tests. */
export const ENTRANCE_MARK = "gmt-entrance-t0";

/** Waits for a promise and treats a rejection as done. */
const settled = (promise: Promise<void>): Promise<void> =>
  promise.then(
    () => {},
    () => {},
  );

export function runHeroEntrance(options: HeroEntranceOptions): void {
  const { sky, globe, signal } = options;
  const now = options.now ?? (() => performance.now());
  const deadline = options.deadline ?? DEFAULT_DEADLINE_MS;
  if (signal.aborted) return;

  let started = false;
  const go = (): void => {
    if (started || signal.aborted) return;
    // The header's state depends on how the page was reached, which the browser reports at its
    // first reveal. Running before it would animate a header that a view transition keeps still.
    const root = document.documentElement;
    if ("onpagereveal" in window && root.dataset["arrival"] === undefined) {
      window.addEventListener("pagereveal", go, { once: true });
      signal.addEventListener(
        "abort",
        () => window.removeEventListener("pagereveal", go),
        { once: true },
      );
      return;
    }
    started = true;
    clearTimeout(timer);
    // A page the failsafe already showed stays as it is: running now would replay the freeze on
    // copy that is on screen. The dawn still starts.
    if (root.dataset["entrance"] !== "static") root.dataset["entrance"] = "run";
    performance.mark(ENTRANCE_MARK);
    globe.startDawn();
    // Nothing animates once the entrance has ended: a card that appears later (hidden, then
    // shown) must not play the opening pop again, so the rules keyed on `run` stop matching.
    if (root.dataset["entrance"] === "run") {
      const rest = setTimeout(() => {
        if (root.dataset["entrance"] === "run")
          root.dataset["entrance"] = "done";
      }, ENTRANCE_MS);
      signal.addEventListener("abort", () => clearTimeout(rest), {
        once: true,
      });
    }
  };

  const timer = setTimeout(go, Math.max(0, deadline - now()));
  signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  void Promise.all([settled(sky.ready), settled(globe.ready)]).then(go);
}
