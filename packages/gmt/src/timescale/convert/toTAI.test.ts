import { Temporal } from "../../internal/temporal";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalInstantFromThrow,
} from "../../test/mocks";
import {
  battleTestTimeZones,
  sameInstantBattleCases,
} from "../../test/timeZoneMatrix";
import { toTAI } from "./toTAI";

/**
 * The 2016 inserted second written as local wall-clock time in every battle-test zone: the
 * zone's reading of 2016-12-31T23:59:59Z with its second field set to 60. None of these zones has
 * a sub-minute offset there, so the local second is 59 and the inserted second follows it
 * (ITU-R TF.460-6 Annex 1 §2.2).
 */
const insertedSecondBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: Temporal.Instant.from("2016-12-31T23:59:59Z")
    .toZonedDateTimeISO(timeZone)
    .toString()
    .replace(/:59(?=[+-])/, ":60"),
}));

describe("toTAI", () => {
  // TAI = UTC + (TAI − UTC), the IERS Leap_Second.dat row in force (Bulletin C 72).
  it.each`
    isoString                           | expected                               | offset
    ${"2026-01-01T00:00:00Z"}           | ${"2026-01-01T00:00:37 TAI"}           | ${"37 s"}
    ${"2013-06-01T00:00:00Z"}           | ${"2013-06-01T00:00:35 TAI"}           | ${"35 s, not 37"}
    ${"1972-01-01T00:00:00Z"}           | ${"1972-01-01T00:00:10 TAI"}           | ${"10 s, the first row"}
    ${"2016-12-31T23:59:59Z"}           | ${"2017-01-01T00:00:35 TAI"}           | ${"36 s"}
    ${"2017-01-01T00:00:00Z"}           | ${"2017-01-01T00:00:37 TAI"}           | ${"37 s"}
    ${"2100-01-01T00:00:00Z"}           | ${"2100-01-01T00:00:37 TAI"}           | ${"37 s, the table is closed"}
    ${"2026-01-01T00:00:00.5Z"}         | ${"2026-01-01T00:00:37.5 TAI"}         | ${"37 s, fraction kept"}
    ${"9999-12-31T23:59:22.999999999Z"} | ${"9999-12-31T23:59:59.999999999 TAI"} | ${"37 s, the last four-digit TAI label"}
    ${"2016-12-31T23:59:59.999999999Z"} | ${"2017-01-01T00:00:35.999999999 TAI"} | ${"36 s, 1 ns before the inserted second"}
  `("returns $expected for $isoString ($offset)", ({ isoString, expected }) => {
    expect(toTAI(isoString)).toBe(expected);
  });

  // An inserted second maps to its own TAI second: the old offset + 1 s (TF.460-6 Annex 1 §2.2).
  it.each`
    isoString                                        | expected
    ${"2016-12-31T23:59:60Z"}                        | ${"2017-01-01T00:00:36 TAI"}
    ${"2016-12-31T23:59:60.5Z"}                      | ${"2017-01-01T00:00:36.5 TAI"}
    ${"2016-12-31T23:59:60.123456789Z"}              | ${"2017-01-01T00:00:36.123456789 TAI"}
    ${"2016-12-31T23:59:60.999999999Z"}              | ${"2017-01-01T00:00:36.999999999 TAI"}
    ${"2017-01-01T08:59:60+09:00"}                   | ${"2017-01-01T00:00:36 TAI"}
    ${"2016-12-31T18:59:60-05:00[America/New_York]"} | ${"2017-01-01T00:00:36 TAI"}
    ${"2015-06-30T23:59:60Z"}                        | ${"2015-07-01T00:00:35 TAI"}
    ${"1972-06-30T23:59:60Z"}                        | ${"1972-07-01T00:00:10 TAI"}
    ${"2017-01-01T08:59:60.5+09:00"}                 | ${"2017-01-01T00:00:36.5 TAI"}
  `(
    "maps the inserted second $isoString to $expected",
    ({ isoString, expected }) => {
      expect(toTAI(isoString)).toBe(expected);
    },
  );

  it.each`
    isoString                           | why
    ${"9999-12-31T23:59:23Z"}           | ${"the TAI label is in year 10000"}
    ${"2017-12-31T23:59:60Z"}           | ${"second 60 with no insertion that day"}
    ${"2016-12-31T12:34:60Z"}           | ${"second 60 mid-day"}
    ${"1971-12-31T23:59:60Z"}           | ${"second 60 before the table"}
    ${"1971-12-31T00:00:00Z"}           | ${"before 1972"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"1 ns before 1972"}
    ${"-271821-04-20T00:00:00Z"}        | ${"Temporal's first instant, before 1972"}
    ${"+275760-09-13T00:00:00Z"}        | ${"Temporal's last instant: its TAI label is past year 9999"}
  `("returns '' for $isoString ($why)", ({ isoString }) => {
    expect(toTAI(isoString)).toBe("");
  });

  it.each`
    isoString                     | label
    ${null}                       | ${"null"}
    ${undefined}                  | ${"undefined"}
    ${123}                        | ${"123"}
    ${""}                         | ${"''"}
    ${"x"}                        | ${"'x'"}
    ${"2024-01-01"}               | ${"'2024-01-01'"}
    ${"2024-01-01T00:00:00"}      | ${"'2024-01-01T00:00:00'"}
    ${"2024-01-01T00:00:00[UTC]"} | ${"'2024-01-01T00:00:00[UTC]'"}
    ${"20240101T000000Z"}         | ${"'20240101T000000Z'"}
  `("returns '' for the invalid $label", ({ isoString }) => {
    expect(toTAI(isoString)).toBe("");
  });

  it.each(sameInstantBattleCases)(
    "returns 2024-02-29T00:00:37 TAI for 2024-02-29T00:00:00Z written in $timeZone",
    ({ value }) => {
      expect(toTAI(value)).toBe("2024-02-29T00:00:37 TAI");
    },
  );

  it.each(insertedSecondBattleCases)(
    "returns 2017-01-01T00:00:36 TAI for the 2016 inserted second written in $timeZone as $value",
    ({ value }) => {
      expect(toTAI(value)).toBe("2017-01-01T00:00:36 TAI");
    },
  );

  it("returns '' when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(toTAI("2016-12-31T23:59:60Z")).toBe("");
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(toTAI("2026-01-01T00:00:00Z")).toBe("");
  });
});
