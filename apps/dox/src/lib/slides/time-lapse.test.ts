/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import {
  LAPSE_MS,
  dateOf,
  ease,
  frameAt,
  instantAt,
  isLapseName,
  lapseLabel,
  planLapse,
  runLapse,
  type LapseTools,
} from "./time-lapse";

const HOUR = 3_600_000;
const tools: LapseTools = {
  nowMs: () => 1_000 * HOUR,
  addHours: (ms, hours) => ms + hours * HOUR,
  stamp: (zone, ms) =>
    `${zone === "Asia/Manila" ? "A" : "B"}${ms}`.padEnd(16, "0"),
  jumpMs: (zone) => (zone === "Asia/Manila" ? 5_000 * HOUR : null),
};

describe("lapse names", () => {
  it("accepts the registered lapses only", () => {
    expect(isLapseName("manila")).toBe(true);
    expect(isLapseName("toString")).toBe(false);
  });
});

describe("planning a lapse", () => {
  it("runs a day from now for a lapse with no jump", () => {
    const plan = planLapse("tehran", tools)!;
    expect(plan.fromMs).toBe(1_000 * HOUR);
    expect(plan.toMs - plan.fromMs).toBe(24 * HOUR);
    expect(plan.durationMs).toBe(LAPSE_MS);
  });

  it("centres the window on the zone's own jump", () => {
    const plan = planLapse("manila", tools)!;
    expect(plan.fromMs).toBe(5_000 * HOUR - 18 * HOUR);
    expect(plan.toMs).toBe(5_000 * HOUR + 18 * HOUR);
  });

  it("gives no plan when gmt knows no jump", () => {
    expect(planLapse("manila", { ...tools, jumpMs: () => null })).toBeNull();
  });

  it("gives no plan when gmt rejects the arithmetic", () => {
    expect(planLapse("sun", { ...tools, addHours: () => null })).toBeNull();
  });
});

describe("a lapse's frames", () => {
  const plan = planLapse("tehran", tools)!;

  it("eases from the start to the end", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
    expect(instantAt(plan, 0)).toBe(plan.fromMs);
    expect(instantAt(plan, 1)).toBe(plan.toMs);
  });

  it("reads each zone's stamp at the frame's instant", () => {
    const frame = frameAt(plan, tools, 1);
    expect(frame.done).toBe(true);
    expect(Object.keys(frame.stamps)).toEqual(["Asia/Tehran"]);
  });

  it("labels a pin with the city, the local date and the local time", () => {
    expect(lapseLabel("Tehran", "2026-11-19T00:12")).toBe(
      "Tehran 2026-11-19 00:12",
    );
    expect(lapseLabel("Tehran", "")).toBe("Tehran");
    expect(dateOf("2026-11-19T00:12")).toBe("2026-11-19");
    expect(dateOf("")).toBe("");
  });
});

describe("running a lapse", () => {
  const plan = planLapse("tehran", tools)!;

  it("shows the end at once under reduced motion", () => {
    const onFrame = vi.fn();
    runLapse({ plan, tools, win: window, reduced: true, onFrame });
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame.mock.calls[0]![0].done).toBe(true);
  });

  it("opens on the start, plays on the browser's stamps and stops when told", () => {
    const callbacks: Array<(stamp: number) => void> = [];
    const win = {
      requestAnimationFrame: (cb: (stamp: number) => void) =>
        callbacks.push(cb),
      cancelAnimationFrame: vi.fn(),
    };
    const frames: boolean[] = [];
    const ms: number[] = [];
    const stop = runLapse({
      plan,
      tools,
      win,
      reduced: false,
      onFrame: (f) => {
        frames.push(f.done);
        ms.push(f.ms);
      },
    });
    expect(ms[0]).toBe(plan.fromMs);
    callbacks.shift()!(100);
    callbacks.shift()!(100 + LAPSE_MS / 2);
    expect(ms.at(-1)).toBeGreaterThan(plan.fromMs);
    expect(ms.at(-1)).toBeLessThan(plan.toMs);
    callbacks.shift()!(100 + LAPSE_MS);
    expect(frames.at(-1)).toBe(true);
    expect(callbacks).toHaveLength(0);
    stop();
  });

  it("plays nothing after it is stopped", () => {
    const callbacks: Array<(stamp: number) => void> = [];
    const win = {
      requestAnimationFrame: (cb: (stamp: number) => void) =>
        callbacks.push(cb),
      cancelAnimationFrame: vi.fn(),
    };
    const onFrame = vi.fn();
    const stop = runLapse({ plan, tools, win, reduced: false, onFrame });
    stop();
    onFrame.mockClear();
    callbacks.shift()!(5);
    expect(onFrame).not.toHaveBeenCalled();
    expect(win.cancelAnimationFrame).toHaveBeenCalled();
  });
});
