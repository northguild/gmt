import { sameInstantBattleCases } from "../../test/timeZoneMatrix";
import { leapSecondsBetween } from "./leapSecondsBetween";

describe("leapSecondsBetween", () => {
  // The change in TAI − UTC (IERS Leap_Second.dat): each leap second whose second starts in [start, end).
  it.each`
    start                     | end                       | expected | why
    ${"2020-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${0}     | ${"37 − 37"}
    ${"2000-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${5}     | ${"37 − 32: 2005, 2008, 2012, 2015, 2016"}
    ${"1972-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${27}    | ${"37 − 10: every insertion"}
    ${"1980-01-06T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${18}    | ${"37 − 19: since the GPS epoch"}
    ${"2024-01-01T00:00:00Z"} | ${"2000-01-01T00:00:00Z"} | ${-5}    | ${"signed: end before start"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${0}     | ${"the same instant"}
    ${"2016-12-31T23:59:60Z"} | ${"2017-01-01T00:00:00Z"} | ${1}     | ${"the inserted second starts inside [start, end)"}
    ${"2016-12-31T23:59:59Z"} | ${"2016-12-31T23:59:60Z"} | ${0}     | ${"the inserted second starts at end, outside [start, end)"}
    ${"2016-12-31T23:59:59Z"} | ${"2017-01-01T00:00:00Z"} | ${1}     | ${"across the inserted second"}
    ${"2017-01-01T00:00:00Z"} | ${"2016-12-31T23:59:60Z"} | ${-1}    | ${"signed, across the inserted second"}
  `(
    "returns $expected from $start to $end ($why)",
    ({ start, end, expected }) => {
      expect(leapSecondsBetween(start, end)).toBe(expected);
    },
  );

  it.each`
    start                     | end                       | why
    ${"1971-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"start before 1972"}
    ${"2024-01-01T00:00:00Z"} | ${"1971-12-31T23:59:59Z"} | ${"end before 1972"}
    ${"2017-12-31T23:59:60Z"} | ${"2024-01-01T00:00:00Z"} | ${"start is a second 60 with no insertion"}
    ${"2024-01-01T00:00:00Z"} | ${"2017-12-31T23:59:60Z"} | ${"end is a second 60 with no insertion"}
  `("returns null when $why", ({ start, end }) => {
    expect(leapSecondsBetween(start, end)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${""}
    ${"x"}
    ${"2024-01-01"}
    ${"2024-01-01T00:00:00"}
    ${"2024-01-01T00:00:00[UTC]"}
    ${"20240101T000000Z"}
  `("returns null when either argument is the invalid $value", ({ value }) => {
    expect(leapSecondsBetween(value, "2024-01-01T00:00:00Z")).toBeNull();
    expect(leapSecondsBetween("2000-01-01T00:00:00Z", value)).toBeNull();
  });

  it.each(sameInstantBattleCases)(
    "returns 5 from 2000-01-01 to 2024-02-29T00:00:00Z written in $timeZone",
    ({ value }) => {
      expect(leapSecondsBetween("2000-01-01T00:00:00Z", value)).toBe(5);
    },
  );
});
