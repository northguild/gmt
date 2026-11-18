/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { filingKey, filings } from "~/data/upstream-filings";
import {
  COUNT_MS,
  decodeSteps,
  encodeSteps,
  pinsAfter,
  planFilingPins,
  runCount,
} from "./filing-pins";

const list = [
  { key: "b", createdAt: "2026-02-01", zone: "Asia/Manila" },
  { key: "a", createdAt: "2026-02-01" },
  { key: "c", createdAt: "2026-01-01", zone: "Asia/Manila" },
  { key: "d", createdAt: "2026-03-01", zone: "Asia/Tokyo" },
];

describe("planning the pins", () => {
  const plan = planFilingPins(list);

  it("orders by filing date, then key, and counts pinned and unpinned", () => {
    expect(plan.steps.map((s) => s.key)).toEqual(["c", "a", "b", "d"]);
    expect([plan.total, plan.pinned, plan.unpinned]).toEqual([4, 3, 1]);
  });

  it("counts filings at each zone after n steps", () => {
    expect([...pinsAfter(plan.steps, 3)]).toEqual([["Asia/Manila", 2]]);
    expect(pinsAfter(plan.steps, 0).size).toBe(0);
    expect(pinsAfter(plan.steps, 99).get("Asia/Tokyo")).toBe(1);
  });

  it("survives the trip through the slide's data attribute", () => {
    expect(decodeSteps(encodeSteps(plan.steps))).toEqual(plan.steps);
    expect(decodeSteps("")).toEqual([]);
  });
});

describe("the running count", () => {
  it("shows the total at once under reduced motion", () => {
    const onStep = vi.fn();
    runCount({ total: 54, win: window, reduced: true, onStep });
    expect(onStep).toHaveBeenCalledExactlyOnceWith(54);
  });

  it("counts up on the browser's stamps and ends on the total", () => {
    const callbacks: Array<(stamp: number) => void> = [];
    const win = {
      requestAnimationFrame: (cb: (stamp: number) => void) =>
        callbacks.push(cb),
      cancelAnimationFrame: vi.fn(),
    };
    const seen: number[] = [];
    const stop = runCount({
      total: 10,
      win,
      reduced: false,
      onStep: (n) => seen.push(n),
    });
    callbacks.shift()!(0);
    callbacks.shift()!(COUNT_MS / 2);
    callbacks.shift()!(COUNT_MS);
    expect(seen[0]).toBe(0);
    expect(seen).toContain(5);
    expect(seen.at(-1)).toBe(10);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    stop();
  });
});

describe("the real filings", () => {
  const plan = planFilingPins(
    filings.map((f) => ({
      key: filingKey(f),
      createdAt: f.createdAt,
      zone: f.zone,
    })),
  );

  it("gives every filing of every tracker, GitHub rows included, its own id", () => {
    expect(filings.some((f) => f.tracker === "github")).toBe(true);
    expect(plan.total).toBe(filings.length);
    expect(new Set(plan.steps.map((s) => s.key)).size).toBe(filings.length);
    expect(plan.steps.every((s) => s.key !== "undefined" && s.key !== "")).toBe(
      true,
    );
  });
});
