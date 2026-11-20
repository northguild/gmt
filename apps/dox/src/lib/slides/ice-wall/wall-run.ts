/**
 * The ice wall's timeline: the approach (the camera flies in), the break (shards in flight) and the
 * frame loop that runs only while something moves. Time is the animation frame's own timestamp: a
 * break marks the panes pending and the next frame is their time zero, so the wall reads no clock.
 * Which state the wall is in is `wall.ts`'s; this moves it from one to the next.
 */
import type { FrameOutput } from "./frame";
import { FADE_END_MS } from "./shards";
import type { WallState } from "./wall";

/** The depth the approach ends at, as a fraction of the wall's rest distance. The panes hang in the
 * left two thirds of the stage and grow away from the Earth's centre as the wall comes near; at this
 * depth the left column's edge is still on the screen, and a deeper approach would carry it off.
 */
const BREAK_DEPTH = 0.93;
/** How long the camera takes to fly in, milliseconds. */
const APPROACH_MS = 900;
/** How long a flight through takes until the last shard has faded, milliseconds: the approach, then the break. */
export const CLEAR_MS = APPROACH_MS + FADE_END_MS;

interface RunDeps {
  win: Window | null;
  reduced(): boolean;
  state(): WallState;
  setState(next: WallState): void;
  /** Draws one frame at timestamp `now`; the shards that landed and whether any still fly. */
  render(now: number | null): FrameOutput | null;
  /** Clears the canvas once the wall is gone. */
  clear(): void;
  /** The panes are about to break: fix where the camera hits and spread the pins. */
  prepareBreak(zones: readonly string[]): void;
  onPin?(zone: string): void;
  onBreak?(): void;
}

interface WallRun {
  /** The wall's depth: 1 at rest, `BREAK_DEPTH` at the end of the approach. */
  depth: number;
  /** Milliseconds into the break at frame time `now`; `null` while no break runs. */
  elapsed(now: number): number | null;
  /** Whether the running break was started under reduced motion. */
  readonly reducedBreak: boolean;
  /** Flies in, then breaks over `zones`; at once under reduced motion. */
  approach(zones: readonly string[]): void;
  /** Breaks at once, without the approach. */
  breakNow(zones: readonly string[]): void;
  /** Hangs whole at depth `z`, cancelling any approach or break. */
  hang(z: number): void;
  /** Stops asking for frames. */
  cancel(): void;
  /** Stops for good. */
  stop(): void;
}

export function createWallRun(d: RunDeps): WallRun {
  let depth = 1;
  let approachFrom = 1;
  /** Frame timestamps. `null` start means "the next frame is zero". */
  let approachStart: number | null = null;
  let breakStart: number | null = null;
  let pendingBreak = false;
  let reducedBreak = false;
  let raf = 0;
  let stopped = false;
  let zonesToPin: readonly string[] = [];
  const pinned = new Set<string>();

  /** Reports a zone as pinned the first time only. */
  const pin = (zone: string): void => {
    if (pinned.has(zone)) return;
    pinned.add(zone);
    d.onPin?.(zone);
  };

  const loop = (now: number): void => {
    raf = 0;
    const state = d.state();
    if (stopped || state === "hidden" || state === "gone") return;
    if (state === "approach") {
      approachStart ??= now;
      const k = Math.min(1, (now - approachStart) / APPROACH_MS);
      depth = approachFrom + (BREAK_DEPTH - approachFrom) * k * k * k;
      d.render(now);
      if (k >= 1) startBreak();
      schedule();
      return;
    }
    if (state === "breaking") {
      if (pendingBreak) {
        breakStart = now;
        pendingBreak = false;
      }
      const out = d.render(now);
      for (const zone of out?.arrived ?? []) pin(zone);
      if (out?.moving) schedule();
      else {
        for (const zone of zonesToPin) pin(zone);
        d.setState("gone");
        d.clear();
      }
    }
  };

  function schedule(): void {
    if (raf || stopped || !d.win) return;
    // ui-standards-ok: open-ended: it runs until the last shard settles, which `play`'s fixed duration cannot say.
    raf = d.win.requestAnimationFrame(loop);
  }

  function startBreak(): void {
    reducedBreak = d.reduced();
    d.prepareBreak(zonesToPin);
    pinned.clear();
    breakStart = null;
    pendingBreak = true;
    d.setState("breaking");
    d.onBreak?.();
    schedule();
  }

  const cancel = (): void => {
    if (raf) d.win?.cancelAnimationFrame(raf);
    raf = 0;
  };

  return {
    get depth() {
      return depth;
    },
    set depth(z) {
      depth = z;
    },
    elapsed: (now) => (breakStart === null ? null : now - breakStart),
    get reducedBreak() {
      return reducedBreak;
    },
    approach(zones) {
      zonesToPin = zones;
      if (d.state() === "hidden") return;
      if (d.reduced()) {
        startBreak();
        return;
      }
      approachFrom = depth;
      approachStart = null;
      d.setState("approach");
      schedule();
    },
    breakNow(zones) {
      zonesToPin = zones;
      if (d.state() === "hidden") return;
      cancel();
      startBreak();
    },
    hang(z) {
      cancel();
      depth = z;
      breakStart = null;
      pendingBreak = false;
      pinned.clear();
      d.setState("whole");
      d.render(null);
    },
    cancel,
    stop() {
      stopped = true;
      cancel();
    },
  };
}
