/// <reference types="vitest/globals" />

import { nextPtMidnightMs, ptDayKey, secondsUntilPtReset } from "./pt-day";

/** 2026-03-08 is the US spring-forward date: Pacific loses an hour at 02:00,
 * making that local day 23 hours long. 2026-11-01 is fall-back, 25 hours. Both
 * are the reason this uses gmt's zoned arithmetic instead of adding 86_400_000. */
const SPRING_FORWARD_LOCAL_NOON = Date.UTC(2026, 2, 8, 19, 0, 0); // 12:00 PDT
const FALL_BACK_LOCAL_NOON = Date.UTC(2026, 10, 1, 20, 0, 0); // 12:00 PST

describe("ptDayKey", () => {
  it("buckets by the Pacific calendar date, not the UTC one", () => {
    // 2026-06-15T03:00Z is still 2026-06-14 in Los Angeles (20:00 PDT).
    const lateEveningPacific = Date.UTC(2026, 5, 15, 3, 0, 0);
    expect(ptDayKey(lateEveningPacific)).toBe("2026-06-14");
  });

  it("rolls over at Pacific midnight, not UTC midnight", () => {
    const justBefore = Date.UTC(2026, 5, 15, 6, 59, 0); // 23:59 PDT on the 14th
    const justAfter = Date.UTC(2026, 5, 15, 7, 1, 0); // 00:01 PDT on the 15th
    expect(ptDayKey(justBefore)).toBe("2026-06-14");
    expect(ptDayKey(justAfter)).toBe("2026-06-15");
  });

  it("does not throw on a nonsense clock", () => {
    expect(ptDayKey(Number.NaN)).toBe("unknown");
  });
});

describe("nextPtMidnightMs", () => {
  it("lands on the next local midnight", () => {
    const noon = Date.UTC(2026, 5, 15, 19, 0, 0); // 12:00 PDT
    const next = nextPtMidnightMs(noon);
    // 00:00 PDT on the 16th is 07:00Z.
    expect(next).toBe(Date.UTC(2026, 5, 16, 7, 0, 0));
  });

  it("is 23 hours away at noon on the spring-forward day", () => {
    // The whole reason for zoned arithmetic: +24h would overshoot midnight.
    const hours =
      (nextPtMidnightMs(SPRING_FORWARD_LOCAL_NOON) -
        SPRING_FORWARD_LOCAL_NOON) /
      3_600_000;
    expect(hours).toBe(12);
    // ...and the day it just started was short:
    const startOfThatDay = Date.UTC(2026, 2, 8, 8, 0, 0); // 00:00 PST
    const dayLength =
      (nextPtMidnightMs(SPRING_FORWARD_LOCAL_NOON) - startOfThatDay) /
      3_600_000;
    expect(dayLength).toBe(23);
  });

  it("is 25 hours long on the fall-back day", () => {
    const startOfThatDay = Date.UTC(2026, 10, 1, 7, 0, 0); // 00:00 PDT
    const dayLength =
      (nextPtMidnightMs(FALL_BACK_LOCAL_NOON) - startOfThatDay) / 3_600_000;
    expect(dayLength).toBe(25);
  });
});

describe("secondsUntilPtReset", () => {
  it("never returns a TTL short enough to expire a key early", () => {
    // One second before midnight, the naive answer is ~1s — far too short for a
    // key that still has to be readable right up to the boundary.
    const oneSecondBefore = Date.UTC(2026, 5, 16, 6, 59, 59);
    expect(secondsUntilPtReset(oneSecondBefore)).toBeGreaterThanOrEqual(60);
  });

  it("covers the whole remaining day plus a margin", () => {
    const justAfterMidnight = Date.UTC(2026, 5, 15, 7, 1, 0);
    const ttl = secondsUntilPtReset(justAfterMidnight);
    expect(ttl).toBeGreaterThan(23 * 3600);
    expect(ttl).toBeLessThan(25 * 3600);
  });
});
