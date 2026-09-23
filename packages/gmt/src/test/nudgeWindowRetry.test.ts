import { describe, expect, it } from "vitest";

import { diffDateTime, intervalLengthDateTime } from "../plain";
import { normalizeDuration } from "../duration";
import { diffUtc } from "../utc";

/**
 * The nudge-window retry, across every operation that needs it.
 *
 * TC39 rounds a duration to a calendar unit by bounding it: `ComputeNudgeWindow` builds the window
 * `[relativeTo + r1 units, relativeTo + r2 units]` from the duration's own count of that unit, and
 * `NudgeToCalendarUnit` then checks that the target actually falls inside it. When it does not, the
 * window is recomputed one unit further along (`additionalShift`), so `r1` becomes 1 rather than 0.
 *
 * `@js-temporal/polyfill` 0.5.1 computes the window once and never retries (its own
 * `assert(start ≤ dest ≤ end)` is compiled out of production builds), so the target sits outside the
 * window, `progress` exceeds 1, and the answer is taken over the wrong bounds. It is reachable only
 * when the duration's own month count is one short of the truth, which is exactly when adding a month
 * constrains the day — a start on the 29th, 30th or 31st.
 *
 * Upstream: tc39/proposal-temporal#3168, fixed by #3172 (`5dd0b0d97ee1`, merged 2025-11-19), which
 * `@js-temporal/polyfill` has not ported on 0.5.1 or `main`. GMT carries the spec algorithm itself
 * (compat defect D11) until a release does.
 *
 * Every expected value below is `Temporal` in Chromium 153.0.8010.12 — native V8, never the polyfill
 * and never GMT. The three directed rounding modes are the ones that diverge; `halfExpand` and
 * `halfEven` agree either way, and are included so a fix cannot quietly move them.
 */

/** start, the span to it, and what Chromium rounds that span to in each mode. */
const CASES = [
  {
    start: "2024-01-31T00:00:00",
    end: "2024-02-29T12:00:00",
    duration: "P29DT12H",
    relativeTo: "2024-01-31",
  },
  {
    start: "2024-01-30T00:00:00",
    end: "2024-02-29T12:00:00",
    duration: "P30DT12H",
    relativeTo: "2024-01-30",
  },
  {
    start: "2024-03-31T00:00:00",
    end: "2024-04-30T12:00:00",
    duration: "P30DT12H",
    relativeTo: "2024-03-31",
  },
  {
    start: "2023-01-31T00:00:00",
    end: "2023-02-28T12:00:00",
    duration: "P28DT12H",
    relativeTo: "2023-01-31",
  },
  {
    start: "2024-05-31T00:00:00",
    end: "2024-06-30T12:00:00",
    duration: "P30DT12H",
    relativeTo: "2024-05-31",
  },
] as const;

/** Chromium 153: the whole month is reached, so the directed modes straddle it. */
const EXPECTED = {
  ceil: { duration: "P2M", months: 2 },
  floor: { duration: "P1M", months: 1 },
  trunc: { duration: "P1M", months: 1 },
  halfExpand: { duration: "P1M", months: 1 },
  halfEven: { duration: "P1M", months: 1 },
} as const;

const MODES = Object.keys(EXPECTED) as Array<keyof typeof EXPECTED>;

describe("the nudge window is retried when the target falls outside it", () => {
  describe("normalizeDuration (Duration#round)", () => {
    for (const { duration, relativeTo } of CASES) {
      for (const mode of MODES) {
        it(`${duration} relative to ${relativeTo}, ${mode}`, () => {
          expect(
            normalizeDuration(duration, {
              smallestUnit: "month",
              roundingMode: mode,
              relativeTo,
            }),
          ).toBe(EXPECTED[mode].duration);
        });
      }
    }
  });

  describe("diffDateTime (until with a calendar smallestUnit)", () => {
    for (const { start, end } of CASES) {
      for (const mode of MODES) {
        it(`${start} to ${end}, ${mode}`, () => {
          expect(
            diffDateTime(start, end, ["months"], {
              smallestUnit: "months",
              roundingMode: mode,
            }),
          ).toEqual({ months: EXPECTED[mode].months });
        });
      }
    }
  });

  describe("diffUtc (until with a calendar smallestUnit)", () => {
    for (const { start, end } of CASES) {
      for (const mode of MODES) {
        it(`${start}Z to ${end}Z, ${mode}`, () => {
          expect(
            diffUtc(`${start}Z`, `${end}Z`, ["months"], {
              smallestUnit: "months",
              roundingMode: mode,
            }),
          ).toEqual({ months: EXPECTED[mode].months });
        });
      }
    }
  });

  /*
   * A second defect, in GMT's own mirror of the algorithm rather than in the polyfill.
   *
   * When the target lands exactly on the window's lower bound the duration is already rounded, and
   * TC39 says so inside `ApplyUnsignedRoundingMode` ("if x is equal to r1, return r1"). GMT's form
   * takes a comparison rather than the value, so it could not see that case and `ceil` expanded an
   * exact boundary to the next whole unit. It was reachable through the non-ISO calendars before
   * this change, and through every calendar once the D11 gate routed ISO here too.
   *
   * Expected values are Chromium 153.0.8010.12.
   */
  describe("a target exactly on a unit boundary is already rounded", () => {
    it.each`
      duration  | relativeTo                   | expected
      ${"P60D"} | ${"2024-01-31"}              | ${"P2M"}
      ${"P31D"} | ${"2024-01-29"}              | ${"P1M"}
      ${"P60D"} | ${"2024-01-30"}              | ${"P2M"}
      ${"P29D"} | ${"2024-02-29"}              | ${"P1M"}
      ${"P30D"} | ${"2024-01-31[u-ca=hebrew]"} | ${"P1M"}
    `(
      "ceil leaves $duration relative to $relativeTo at $expected",
      ({ duration, relativeTo, expected }) => {
        expect(
          normalizeDuration(duration, {
            smallestUnit: "month",
            roundingMode: "ceil",
            relativeTo,
          }),
        ).toBe(expected);
      },
    );
  });

  // Already fixed; kept so the total path cannot regress while the others are wired up.
  describe("intervalLengthDateTime (Duration#total)", () => {
    it("2024-01-31T00:00:00 to 2024-02-29T12:00:00 in months", () => {
      expect(
        intervalLengthDateTime(
          "2024-01-31T00:00:00",
          "2024-02-29T12:00:00",
          "month",
        ),
      ).toBeCloseTo(1.0161290322580645, 12);
    });
  });
});
