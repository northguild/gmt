import { calendarZonedFixtures } from "../test";
import { parseCalendarZonedPairForArithmetic } from "./calendarZonedPairPolicy";

const Y = calendarZonedFixtures.hebrewLeapYearSpan;
const islamicEnd =
  "2024-10-03T00:00:00-04:00[America/New_York][u-ca=islamic-tbla]";

describe("parseCalendarZonedPairForArithmetic", () => {
  it.each`
    label              | aValue                   | bValue                   | calendar
    ${"both hebrew"}   | ${Y.tishri1_5784NewYork} | ${Y.tishri1_5785NewYork} | ${"hebrew"}
    ${"both bare ISO"} | ${Y.isoStart}            | ${Y.isoEnd}              | ${"iso8601"}
  `("resolves $label to calendar $calendar", ({ aValue, bValue, calendar }) => {
    const pair = parseCalendarZonedPairForArithmetic(aValue, bValue);

    expect(pair.calendar).toBe(calendar);
    expect(pair.a.calendarId).toBe(calendar);
    expect(pair.b.calendarId).toBe(calendar);
  });

  // TC39 DifferenceTemporalZonedDateTime: CalendarEquals is false -> RangeError, for every
  // largestUnit including "hour" and "nanosecond". Native Temporal (Chromium 153) throws
  // "Mismatched calendars." for these pairs.
  it.each`
    label                    | aValue                   | bValue
    ${"hebrew and islamic"}  | ${Y.tishri1_5784NewYork} | ${islamicEnd}
    ${"hebrew and bare ISO"} | ${Y.tishri1_5784NewYork} | ${Y.isoEnd}
  `(
    "throws a RangeError for $label, as Temporal's until does",
    ({ aValue, bValue }) => {
      expect(() => parseCalendarZonedPairForArithmetic(aValue, bValue)).toThrow(
        RangeError,
      );
    },
  );

  it("measures in the shared calendar when both endpoints agree", () => {
    const pair = parseCalendarZonedPairForArithmetic(
      Y.tishri1_5784NewYork,
      Y.tishri1_5785NewYork,
    );

    expect(
      pair.a
        .until(pair.b, { largestUnit: "month" })
        .total({ unit: "month", relativeTo: pair.a }),
    ).toBe(13);
  });

  it("throws when either value is not a valid GMT zoned string", () => {
    expect(() =>
      parseCalendarZonedPairForArithmetic("invalid", Y.isoEnd),
    ).toThrow();
    expect(() =>
      parseCalendarZonedPairForArithmetic(
        Y.isoStart,
        "2024-10-03T14:30:45-04:00[u-ca=hebrew][America/New_York]",
      ),
    ).toThrow();
  });
});
