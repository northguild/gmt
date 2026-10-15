import { Temporal } from "@js-temporal/polyfill";
import { LEAP_SECOND_STEPS } from "../../internal";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { sameInstantBattleCases } from "../../test/timeZoneMatrix";
import { isLeapSecond } from "./isLeapSecond";

/** The 27 insertion days: the UTC date before each row after the first (TF.460-6 Annex 1 §2.2). */
const insertionDays = LEAP_SECOND_STEPS.at.slice(1).map((at) => ({
  day: Temporal.Instant.fromEpochNanoseconds(at)
    .toZonedDateTimeISO("UTC")
    .toPlainDate()
    .subtract({ days: 1 })
    .toString(),
}));

describe("isLeapSecond", () => {
  it.each`
    isoString                                        | why
    ${"2016-12-31T23:59:60Z"}                        | ${"the last insertion"}
    ${"1972-06-30T23:59:60Z"}                        | ${"the first insertion"}
    ${"2008-12-31T23:59:60.999999999Z"}              | ${"the last nanosecond of the 2008 insertion"}
    ${"2009-01-01T08:59:60+09:00"}                   | ${"the 2008 insertion written at +09:00"}
    ${"2016-12-31T18:59:60-05:00[America/New_York]"} | ${"the 2016 insertion written in New York"}
  `("returns true for $isoString ($why)", ({ isoString }) => {
    expect(isLeapSecond(isoString)).toBe(true);
  });

  it.each`
    isoString                 | why
    ${"2017-12-31T23:59:60Z"} | ${"well-formed, no insertion that day"}
    ${"2016-06-30T23:59:60Z"} | ${"a month end with no insertion (2016's was in December)"}
    ${"2016-12-31T12:34:60Z"} | ${"second 60 mid-day"}
    ${"1971-12-31T23:59:60Z"} | ${"before the table"}
    ${"2016-12-31T23:59:59Z"} | ${"an ordinary second"}
  `("returns false for $isoString ($why)", ({ isoString }) => {
    expect(isLeapSecond(isoString)).toBe(false);
  });

  it.each`
    isoString                 | why
    ${"20161231T235960Z"}     | ${"basic format"}
    ${"2016-12-31t23:59:60Z"} | ${"lower-case t"}
    ${"2016-12-31 23:59:60Z"} | ${"space separator"}
    ${"2016-12-31T23:59:60"}  | ${"no designator, so not an instant"}
    ${"2016-12-31T23:59:61Z"} | ${"second 61"}
  `("returns false for $isoString ($why)", ({ isoString }) => {
    expect(isLeapSecond(isoString)).toBe(false);
  });

  it.each(insertionDays)(
    "returns true for $day T23:59:60Z and false for $day T23:59:59Z",
    ({ day }) => {
      expect(isLeapSecond(`${day}T23:59:60Z`)).toBe(true);
      expect(isLeapSecond(`${day}T23:59:59Z`)).toBe(false);
    },
  );

  it.each`
    isoString
    ${null}
    ${undefined}
    ${123}
    ${""}
    ${"x"}
    ${"2024-01-01"}
    ${"2024-01-01T00:00:00"}
    ${"2024-01-01T00:00:00[UTC]"}
    ${"20240101T000000Z"}
  `("returns false for the invalid $isoString", ({ isoString }) => {
    expect(isLeapSecond(isoString)).toBe(false);
  });

  it.each(sameInstantBattleCases)(
    "returns false for 2024-02-29T00:00:00Z written in $timeZone",
    ({ value }) => {
      expect(isLeapSecond(value)).toBe(false);
    },
  );

  it("returns false when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(isLeapSecond("2016-12-31T23:59:60Z")).toBe(false);
  });
});
