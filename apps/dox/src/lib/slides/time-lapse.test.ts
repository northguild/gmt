/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import {
  LAPSE_MS,
  dateOf,
  ease,
  frameAt,
  instantAt,
  isDayLong,
  lapseToolsFrom,
  lapseEndMs,
  lapseLabel,
  planLapse,
  rateAt,
  runLapse,
  type LapseTools,
} from "./time-lapse";
import { loadDeckGmt } from "./gmt-loader";
import { FIXTURE_LAPSES as LAPSES } from "~/test/deck-stage-fixture";

const HOUR = 3_600_000;
const plan_ = (
  name: keyof typeof LAPSES,
  t: LapseTools,
  carry?: Parameters<typeof planLapse>[3],
) => planLapse(name, LAPSES[name], t, carry);
const tools: LapseTools = {
  nowMs: () => 1_000 * HOUR,
  addHours: (ms, hours) => ms + hours * HOUR,
  stamp: (zone, ms) =>
    `${zone === "Asia/Manila" ? "A" : "B"}${ms}`.padEnd(16, "0"),
  utcMs: (iso) => (iso === "2027-02-06T15:56:00Z" ? 2_000 * HOUR : null),
  jumpMs: (zone) => (zone === "Asia/Manila" ? 5_000 * HOUR : null),
};

describe("planning a lapse", () => {
  it("runs a day from now for a lapse with no jump", () => {
    const plan = plan_("open", tools)!;
    expect(plan.fromMs).toBe(1_000 * HOUR);
    expect(plan.toMs - plan.fromMs).toBe(24 * HOUR);
    expect(plan.durationMs).toBe(LAPSE_MS);
  });

  it("centres the window on the zone's own jump", () => {
    const plan = plan_("jump", tools)!;
    expect(plan.fromMs).toBe(5_000 * HOUR - 18 * HOUR);
    expect(plan.toMs).toBe(5_000 * HOUR + 18 * HOUR);
  });

  it("gives no plan when gmt knows no jump", () => {
    expect(plan_("jump", { ...tools, jumpMs: () => null })).toBeNull();
  });

  it("gives no plan when gmt rejects the arithmetic", () => {
    expect(plan_("sun", { ...tools, addHours: () => null })).toBeNull();
  });
});

describe("a day-long lapse after another", () => {
  const carry = { ms: 1_010 * HOUR, rate: 2_000 };

  it("starts on the instant on screen, a whole day long", () => {
    const plan = plan_("plain", tools, carry)!;
    expect(plan.fromMs).toBe(1_010 * HOUR);
    expect(plan.toMs - plan.fromMs).toBe(24 * HOUR);
    expect(instantAt(plan, 0)).toBe(1_010 * HOUR);
    expect(instantAt(plan, 1)).toBe(1_034 * HOUR);
  });

  it("starts at the speed the sun was going, and ends at rest", () => {
    const plan = plan_("plain", tools, carry)!;
    expect(rateAt(plan, 0)).toBe(2_000);
    // The first sixtieth of a second moves the sun on at about that speed, not from a stop.
    const first = instantAt(plan, 1 / 60 / (LAPSE_MS / 1_000));
    expect((first - plan.fromMs) / (1_000 / 60)).toBeCloseTo(2_000, -2);
    expect(rateAt(plan, 1)).toBe(0);
  });

  it("never runs the sun backwards, even from the fastest carry", () => {
    const plan = plan_("plain", tools, { ms: carry.ms, rate: 1e9 })!;
    let last = instantAt(plan, 0);
    for (let i = 1; i <= 1_000; i++) {
      const ms = instantAt(plan, i / 1_000);
      expect(ms).toBeGreaterThanOrEqual(last);
      last = ms;
    }
    expect(last).toBe(plan.toMs);
  });

  it("starts at rest when the last lapse had stopped", () => {
    const plan = plan_("plain", tools, { ms: carry.ms, rate: 0 })!;
    expect(plan.startRate).toBeUndefined();
    expect(rateAt(plan, 0)).toBe(0);
  });

  it("is only for the lapses that run a day from now", () => {
    expect(isDayLong(LAPSES.plain)).toBe(true);
    expect(isDayLong(LAPSES.sun)).toBe(true);
    expect(isDayLong(LAPSES.jump)).toBe(false);
    expect(isDayLong(LAPSES.ends)).toBe(false);
  });

  it("moves no window fixed in history", () => {
    expect(plan_("jump", tools, carry)!.fromMs).toBe(5_000 * HOUR - 18 * HOUR);
  });
});

describe("the lapse that ends on an instant", () => {
  it("runs the two hours before its end and stops on its instant", () => {
    const plan = plan_("ends", tools)!;
    expect(plan.toMs).toBe(2_000 * HOUR);
    expect(plan.toMs - plan.fromMs).toBe(2 * HOUR);
    expect(plan.durationMs).toBe(8000);
    expect(lapseEndMs(LAPSES.ends, tools)).toBe(2_000 * HOUR);
    expect(lapseEndMs(LAPSES.open, tools)).toBeNull();
  });

  it("gives no plan when gmt rejects the instant", () => {
    expect(plan_("ends", { ...tools, utcMs: () => null })).toBeNull();
  });

  it("reads Shanghai from 21:56 to 23:56 with gmt", async () => {
    const real = lapseToolsFrom(await loadDeckGmt());
    const plan = plan_("ends", real)!;
    expect(real.stamp("Asia/Shanghai", plan.fromMs)).toBe("2027-02-06T21:56");
    expect(frameAt(plan, real, 1).stamps["Asia/Shanghai"]).toBe(
      "2027-02-06T23:56",
    );
  });

  it("shows its end at once under reduced motion", () => {
    const frames: number[] = [];
    runLapse({
      plan: plan_("ends", tools)!,
      tools,
      win: { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} },
      reduced: true,
      onFrame: (f) => frames.push(f.ms),
    });
    expect(frames).toEqual([2_000 * HOUR]);
  });
});

describe("a lapse's frames", () => {
  const plan = plan_("open", tools)!;

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
  const plan = plan_("open", tools)!;

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
