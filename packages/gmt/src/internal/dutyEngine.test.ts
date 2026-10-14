import { MAX_PERIOD_COUNT } from "./dutyRules";
import type { UnitScale } from "./dutyPeriods";
import { Unrepresentable, walkBoundaries } from "./dutyEngine";

const DAY = 86_400_000_000_000n;

/** Whole UTC days, counting every lookup, so a test sees whether the walk ran. */
function countedDays() {
  let lookups = 0;
  const scale: UnitScale = {
    basis: "calendar",
    windowStarts: new Map(),
    containing: (x) => {
      lookups++;
      const start = x - (((x % DAY) + DAY) % DAY);
      return { start, end: start + DAY };
    },
  };
  return { scale, lookups: () => lookups };
}

describe("walkBoundaries", () => {
  it("visits the end of every day inside the span, from the day it starts in", () => {
    const { scale } = countedDays();
    const visited: bigint[] = [];

    walkBoundaries(scale, "day", DAY / 2n, 3n * DAY, (end) =>
      visited.push(end),
    );

    expect(visited).toEqual([DAY, 2n * DAY, 3n * DAY]);
  });

  it.each`
    days                    | reason
    ${MAX_PERIOD_COUNT + 1} | ${"one more day than the walk may visit"}
    ${MAX_PERIOD_COUNT + 2} | ${"two more"}
  `("refuses $days days by walking them: $reason", ({ days }) => {
    const { scale, lookups } = countedDays();

    expect(() =>
      walkBoundaries(scale, "day", 0n, BigInt(days) * DAY, () => {}),
    ).toThrow(Unrepresentable);
    expect(lookups()).toBe(MAX_PERIOD_COUNT + 1);
  });

  it("walks exactly the most days it may visit", () => {
    const { scale } = countedDays();
    let visits = 0;

    walkBoundaries(
      scale,
      "day",
      0n,
      BigInt(MAX_PERIOD_COUNT) * DAY,
      () => visits++,
    );

    expect(visits).toBe(MAX_PERIOD_COUNT);
  });

  // No day lasts 8 days, so a span of 10,001 × 8 days certainly holds more than 10,000 day ends.
  it("refuses a span certainly too long without a lookup", () => {
    const { scale, lookups } = countedDays();

    expect(() =>
      walkBoundaries(
        scale,
        "day",
        0n,
        BigInt(MAX_PERIOD_COUNT + 1) * 8n * DAY,
        () => {},
      ),
    ).toThrow(Unrepresentable);
    expect(lookups()).toBe(0);
  });

  it("visits nothing when the span is empty", () => {
    const { scale, lookups } = countedDays();

    walkBoundaries(scale, "day", DAY, DAY, () => {});

    expect(lookups()).toBe(0);
  });
});
