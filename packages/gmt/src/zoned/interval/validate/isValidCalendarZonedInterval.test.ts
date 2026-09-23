import { calendarZonedFixtures } from "../../../test";
import { isValidCalendarZonedInterval } from "./isValidCalendarZonedInterval";
import { isValidZonedInterval } from "./isValidZonedInterval";

const Y = calendarZonedFixtures.hebrewLeapYearSpan;
const ISLAMIC_END =
  "2024-10-03T00:00:00-04:00[America/New_York][u-ca=islamic-tbla]";

describe("isValidCalendarZonedInterval", () => {
  it.each`
    start                                            | end                      | reason
    ${Y.isoStart}                                    | ${Y.isoEnd}              | ${"both bare ISO"}
    ${Y.tishri1_5784NewYork}                         | ${Y.tishri1_5785NewYork} | ${"both Hebrew"}
    ${Y.tishri1_5784NewYork}                         | ${ISLAMIC_END}           | ${"Hebrew start with an islamic-tabular end (D4-zoned accepts mixed calendars)"}
    ${Y.tishri1_5784NewYork}                         | ${Y.isoEnd}              | ${"Hebrew start with a bare ISO end"}
    ${Y.isoStart}                                    | ${Y.tishri1_5785NewYork} | ${"bare ISO start with a Hebrew end"}
    ${Y.tishri1_5784NewYork}                         | ${Y.tishri1_5784NewYork} | ${"equal endpoints (zero-length interval)"}
    ${"2024-01-01T10:00:00+00:00[UTC][u-ca=hebrew]"} | ${Y.isoEnd}              | ${"RFC 9557 hebrew start in UTC before a bare New York end"}
  `("returns true for $start .. $end ($reason)", ({ start, end }) => {
    expect(isValidCalendarZonedInterval(start, end)).toBe(true);
  });

  it.each`
    start                                                         | end                                                           | reason
    ${Y.tishri1_5785NewYork}                                      | ${Y.tishri1_5784NewYork}                                      | ${"start after end"}
    ${"2024-01-01T10:00:00+00:00[u-ca=hebrew][UTC]"}              | ${Y.isoEnd}                                                   | ${"calendar annotation before the zone on the start (not RFC 9557)"}
    ${Y.isoStart}                                                 | ${"2024-10-03T00:00:00-04:00[u-ca=hebrew][America/New_York]"} | ${"calendar annotation before the zone on the end"}
    ${"2024-13-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${Y.isoEnd}                                                   | ${"ISO month 13 (the digits are ISO)"}
    ${"2024-06-30T23:59:60+00:00[UTC]"}                           | ${Y.isoEnd}                                                   | ${"leap second"}
    ${"invalid"}                                                  | ${Y.isoEnd}                                                   | ${"unparseable start"}
    ${Y.isoStart}                                                 | ${"invalid"}                                                  | ${"unparseable end"}
  `("returns false for $start .. $end ($reason)", ({ start, end }) => {
    expect(isValidCalendarZonedInterval(start, end)).toBe(false);
  });

  it.each`
    start        | end
    ${null}      | ${null}
    ${undefined} | ${undefined}
    ${123}       | ${456}
  `(
    "returns false when $start / $end are non-string input",
    ({ start, end }) => {
      expect(
        isValidCalendarZonedInterval(
          start as unknown as string,
          end as unknown as string,
        ),
      ).toBe(false);
    },
  );

  // Q2: the old validator is untouched, so the ~72 out-of-scope functions gated on it keep
  // rejecting the annotation while the calendar-aware siblings accept it.
  it("accepts what the untouched isValidZonedInterval still rejects", () => {
    expect(
      isValidZonedInterval(Y.tishri1_5784NewYork, Y.tishri1_5785NewYork),
    ).toBe(false);
    expect(
      isValidCalendarZonedInterval(
        Y.tishri1_5784NewYork,
        Y.tishri1_5785NewYork,
      ),
    ).toBe(true);

    // Bare ISO behaves identically through both.
    expect(isValidZonedInterval(Y.isoStart, Y.isoEnd)).toBe(true);
    expect(isValidCalendarZonedInterval(Y.isoStart, Y.isoEnd)).toBe(true);
  });
});
