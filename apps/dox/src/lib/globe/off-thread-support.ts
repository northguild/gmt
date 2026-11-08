/**
 * Whether the canvas-2D globe can draw in a worker (#289).
 *
 * It needs a canvas that can hand its bitmap to a worker (`transferControlToOffscreen`) and
 * somewhere to run it. Module-worker support has no static test, so a worker that fails to
 * start is caught by `renderer-canvas2d-worker.ts`, which rejects, and the shell then draws on
 * the main thread. A missing feature and a failed start therefore end the same way: the
 * globe still draws.
 */

/** The parts of the platform the check reads, so a test can supply its own. */
export interface OffThreadEnvironment {
  Worker?: unknown;
  OffscreenCanvas?: unknown;
  HTMLCanvasElement?: { prototype: object };
}

export function canDrawOffThread(
  env: OffThreadEnvironment = globalThis as unknown as OffThreadEnvironment,
): boolean {
  return (
    typeof env.Worker === "function" &&
    typeof env.OffscreenCanvas === "function" &&
    env.HTMLCanvasElement !== undefined &&
    "transferControlToOffscreen" in env.HTMLCanvasElement.prototype
  );
}
