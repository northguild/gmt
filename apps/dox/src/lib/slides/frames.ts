/**
 * The one animation loop every slide visual plays on: a draw callback driven over a fixed
 * duration by the browser's frame stamp. It reads no clock; the stamp alone measures elapsed time.
 * Every timed effect on the deck (typing, rolling counters, time-lapses, the Sun glide, the
 * filings count) calls `play` rather than writing its own `requestAnimationFrame` loop.
 */

/** The two frame calls a loop needs; `window` satisfies it, and tests pass a fake. */
export interface Frames {
  requestAnimationFrame(callback: (stamp: number) => void): number;
  cancelAnimationFrame(handle: number): void;
}

/**
 * Calls `draw(t)` with `t` running from 0 to 1 over `durationMs`, once at once with 0 and then on
 * every frame, then calls `done`. Returns a function that stops it; `done` never runs after a stop.
 */
export function play(
  win: Frames,
  durationMs: number,
  draw: (t: number) => void,
  done: () => void = () => {},
): () => void {
  let handle = 0;
  let start: number | null = null;
  let stopped = false;
  const step = (stamp: number): void => {
    if (stopped) return;
    start ??= stamp;
    const t = durationMs <= 0 ? 1 : Math.min(1, (stamp - start) / durationMs);
    draw(t);
    if (t < 1) handle = win.requestAnimationFrame(step);
    else done();
  };
  draw(0);
  handle = win.requestAnimationFrame(step);
  return () => {
    stopped = true;
    win.cancelAnimationFrame(handle);
  };
}
