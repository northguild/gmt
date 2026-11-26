/**
 * The presenter's time: the time since the talk started against the plan, the pace and the local
 * time, with the Start and Reset buttons.
 *
 * Time is gmt's, loaded by dynamic import after first paint (`getUnixNow` for elapsed time,
 * `getZonedNow` and `formatZonedDateTime` for the local time). The tick is one `setTimeout`
 * chained to the next whole second; it stops while the page is hidden and resyncs on return.
 * Elapsed time starts on the first step past the title or on Start. Seconds are never announced:
 * the pace readout announces when it crosses between behind and not behind.
 */
import { PRESENTER_INITIAL } from "~/widgets/builders/presenter";
import {
  elapsedMs,
  formatClock,
  formatPace,
  msToNextSecond,
  pace as paceOf,
  paceTone,
  plannedMsAt,
  type PaceSide,
} from "./pace";
import type { PresenterElements } from "./presenter-elements";

/** The deck's language, for the local time. */
const LOCALE = "en-GB";

/** gmt's clock, as the presenter uses it. */
interface Clock {
  now(): number;
  localTime(): string;
}

async function loadClock(): Promise<Clock | null> {
  try {
    const [unix, zoned, format] = await Promise.all([
      import("@northguild/gmt/unix/get"),
      import("@northguild/gmt/zoned/get"),
      import("@northguild/gmt/zoned/format"),
    ]);
    const zone = zoned.getSystemTimeZone();
    return {
      now: () => unix.getUnixNow(),
      localTime: () =>
        format.formatZonedDateTime(
          zoned.getZonedNow(zone, { smallestUnit: "minute" }),
          LOCALE,
          { hour: "2-digit", minute: "2-digit" },
        ),
    };
  } catch {
    return null;
  }
}

interface PresenterClock {
  /** Redraws the plan line and the readouts. */
  paint(): void;
  /** Starts the elapsed time, unless it has started or the clock has not loaded. */
  start(): void;
}

export function mountPresenterClock(o: {
  doc: Document;
  signal: AbortSignal;
  els: Pick<
    PresenterElements,
    | "plan"
    | "elapsedOut"
    | "paceOut"
    | "timeOut"
    | "paceCell"
    | "startButton"
    | "resetButton"
  >;
  /** The slides' planned minutes, in order. */
  plan: readonly { minutes: number | null }[];
  /** The shown slide. */
  slide: () => number;
  /** Whether the talk has begun, so a clock that loads late starts at once. */
  begun: () => boolean;
  /** Says a line on the page's status region. */
  say: (text: string) => void;
}): PresenterClock {
  const { doc, signal, plan } = o;
  const { elapsedOut, paceOut, timeOut, paceCell, startButton, resetButton } =
    o.els;
  let clock: Clock | null = null;
  let startMs: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSide: PaceSide | null = null;

  const paint = (): void => {
    o.els.plan.textContent = `Plan at the start of this slide: ${formatClock(plannedMsAt(plan, o.slide()))}`;
    if (!clock) return;
    const now = clock.now();
    timeOut.value = clock.localTime() || PRESENTER_INITIAL.time;
    if (startMs === null) {
      elapsedOut.value = PRESENTER_INITIAL.elapsed;
      paceOut.value = PRESENTER_INITIAL.pace;
      paceCell.dataset["tone"] = "spring";
      lastSide = null;
      return;
    }
    const elapsed = elapsedMs(startMs, now);
    elapsedOut.value = formatClock(elapsed);
    const p = paceOf(plannedMsAt(plan, o.slide()), elapsed);
    paceOut.value = formatPace(p);
    paceCell.dataset["tone"] = paceTone(p);
    // Announce only when the pace crosses between behind and not behind.
    if (lastSide !== null && (lastSide === "behind") !== (p.side === "behind"))
      paceOut.announce();
    lastSide = p.side;
  };

  const tick = (): void => {
    timer = undefined;
    paint();
    if (clock && !doc.hidden)
      timer = setTimeout(tick, msToNextSecond(clock.now()));
  };
  const restart = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (clock && !doc.hidden) tick();
  };
  doc.addEventListener("visibilitychange", restart, { signal });

  const start = (): void => {
    if (startMs !== null || !clock) return;
    startMs = clock.now();
    startButton.disabled = true;
    restart();
  };
  startButton.addEventListener("click", start, { signal });

  // Reset takes two presses; leaving the button gives the first one back.
  let confirming = false;
  const disarm = (): void => {
    confirming = false;
    resetButton.textContent = "Reset";
  };
  resetButton.addEventListener(
    "click",
    () => {
      if (!confirming) {
        confirming = true;
        resetButton.textContent = "Confirm reset";
        o.say("Press Confirm reset to start the timer again from zero");
        return;
      }
      disarm();
      startMs = null;
      lastSide = null;
      startButton.disabled = false;
      o.say("Timer reset: it starts on the next step or on Start");
      paint();
    },
    { signal },
  );
  resetButton.addEventListener("blur", disarm, { signal });

  // The clock loads after first paint; until then the readouts hold their first values.
  void loadClock().then((loaded) => {
    if (signal.aborted) return;
    clock = loaded;
    if (!clock) {
      o.say("The clock could not load: reload this page");
      return;
    }
    // A talk that began before the clock loaded starts now.
    if (o.begun()) start();
    restart();
  });
  signal.addEventListener(
    "abort",
    () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
    { once: true },
  );

  return { paint, start };
}
