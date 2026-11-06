import { runInBoundedChild } from "../../test/boundedChild";
import { calendarSystems } from "../calendarSystemIds";
import { MAX_MONTHS_IN_RANGE, assertMonthsInRange } from "./monthRange";

/*
 * The bound is an upper bound derived from the specification (see monthRange.ts); the rows here
 * check it against the real full-range month count of every GMT calendar.
 */

describe("assertMonthsInRange", () => {
  it("MAX_MONTHS_IN_RANGE is the derivation, 13 months × (⌈200,000,001 days / 353⌉ + 1 years)", () => {
    expect(MAX_MONTHS_IN_RANGE).toBe(13 * (Math.ceil(200_000_001 / 353) + 1));
  });

  it.each`
    months
    ${7_365_462}
    ${-7_365_462}
    ${0}
    ${1}
  `("months $months → no throw (at or inside the bound)", ({ months }) => {
    expect(() => {
      assertMonthsInRange(months);
    }).not.toThrow();
  });

  it.each`
    months
    ${7_365_463}
    ${-7_365_463}
    ${4_294_967_295}
    ${-4_294_967_295}
  `("months $months → RangeError (past the bound)", ({ months }) => {
    expect(() => {
      assertMonthsInRange(months);
    }).toThrow(RangeError);
  });
});

describe("MAX_MONTHS_IN_RANGE covers every calendar", () => {
  const monthsAcrossRange = async (calendar: string) => {
    const run = await runInBoundedChild([
      `gmt.diffDate("-271821-04-19[u-ca=${calendar}]", "+275760-09-13[u-ca=${calendar}]", "months")`,
    ]);
    expect(
      { timedOut: run.timedOut, crashed: run.crashed },
      run.stderr,
    ).toEqual({ timedOut: false, crashed: false });
    return run.calls[0]?.value;
  };

  it.each(calendarSystems.map((calendar) => ({ calendar })))(
    "$calendar: the whole date range is fewer months than the bound",
    async ({ calendar }) => {
      const months = await monthsAcrossRange(calendar);
      expect(typeof months).toBe("number");
      expect(Math.abs(months as number)).toBeLessThan(MAX_MONTHS_IN_RANGE);
    },
  );

  it("hebrew: the whole date range is 6,772,637 months (the largest of any calendar)", async () => {
    expect(await monthsAcrossRange("hebrew")).toBe(6_772_637);
  });
});
