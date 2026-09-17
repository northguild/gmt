import { Temporal } from "@js-temporal/polyfill";
import { measureNearRangeEnd } from "./measureNearRangeEnd";

// Days from a date to the first day of the month after it; throws past +275760-09-13.
const daysToNextMonth = (from: Temporal.PlainDate): number =>
  from.until(from.add({ months: 1 }).with({ day: 1 })).days;

describe("measureNearRangeEnd", () => {
  // September has 30 days, so 09-13 is 18 days before 10-01 and 09-01 is 30 days before it. The
  // shifted proxy (a date 400·k years earlier) has the same September. 2024-02-10 is 20 days
  // before 03-01 (2024 is a leap year) and needs no proxy.
  it.each`
    value                            | expected
    ${"+275760-09-13"}               | ${18}
    ${"+275760-09-01"}               | ${30}
    ${"+275760-09-13[u-ca=gregory]"} | ${18}
    ${"2024-02-10"}                  | ${20}
  `(
    "returns $expected days from $value to the next month start",
    ({ value, expected }) => {
      expect(
        measureNearRangeEnd(Temporal.PlainDate.from(value), daysToNextMonth),
      ).toBe(expected);
    },
  );

  it("rethrows for a source below the proxy year, whose failure is not a max-edge one", () => {
    expect(() =>
      measureNearRangeEnd(Temporal.PlainDate.from("2024-01-01"), () => {
        throw new RangeError("boom");
      }),
    ).toThrow(RangeError);
  });

  it("rethrows for a calendar whose months are not Gregorian (hebrew)", () => {
    const source =
      Temporal.PlainDate.from("+200000-01-01").withCalendar("hebrew");
    expect(() =>
      measureNearRangeEnd(source, () => {
        throw new RangeError("boom");
      }),
    ).toThrow(RangeError);
  });
});
