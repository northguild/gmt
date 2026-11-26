import { describe, expect, it, vi } from "vitest";

import { afterFrames } from "./frames";

function frames() {
  const callbacks: Array<(stamp: number) => void> = [];
  return {
    callbacks,
    win: {
      requestAnimationFrame: (cb: (stamp: number) => void) =>
        callbacks.push(cb),
    },
  };
}

describe("afterFrames", () => {
  it("runs at once for no frames", () => {
    const { callbacks, win } = frames();
    const fn = vi.fn();
    afterFrames(win, 0, fn);
    expect(fn).toHaveBeenCalledOnce();
    expect(callbacks).toHaveLength(0);
  });

  it("runs only once the last of its frames has come", () => {
    const { callbacks, win } = frames();
    const fn = vi.fn();
    afterFrames(win, 2, fn);
    callbacks.shift()!(0);
    expect(fn).not.toHaveBeenCalled();
    callbacks.shift()!(16);
    expect(fn).toHaveBeenCalledOnce();
    expect(callbacks).toHaveLength(0);
  });

  it("never runs once its signal aborts", () => {
    const { callbacks, win } = frames();
    const fn = vi.fn();
    const own = new AbortController();
    afterFrames(win, 2, fn, own.signal);
    callbacks.shift()!(0);
    own.abort();
    callbacks.shift()!(16);
    expect(fn).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(0);
  });
});
