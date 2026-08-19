import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { intervalCountUnix } from "./intervalCountUnix";

// Epoch values used below, in ISO 8601 UTC:
// 0             is 1970-01-01T00:00:00Z
// 1704067200000 is 2024-01-01T00:00:00Z
// 1704085200000 is 2024-01-01T05:00:00Z
// 1704105000000 is 2024-01-01T10:30:00Z
// 1704110400000 is 2024-01-01T12:00:00Z
// 1704153540000 is 2024-01-01T23:59:00Z
// 1704153660000 is 2024-01-02T00:01:00Z
// 1704240000000 is 2024-01-03T00:00:00Z
// 1709596800000 is 2024-03-05T00:00:00Z
// 1735689600000 is 2025-01-01T00:00:00Z
// 1710046800000 is 2024-03-10T00:00:00-05:00[America/New_York]
// 1710129600000 is 2024-03-11T00:00:00-04:00[America/New_York]

describe("intervalCountUnix", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
  });

  it.each`
    start            | end              | unit        | expected
    ${1704067200000} | ${1704240000000} | ${"day"}    | ${2}
    ${1704153540000} | ${1704153660000} | ${"day"}    | ${2}
    ${1704105000000} | ${1704110400000} | ${"hour"}   | ${2}
    ${1704067200000} | ${1709596800000} | ${"month"}  | ${3}
    ${1704067200000} | ${1735689600000} | ${"year"}   | ${1}
    ${0}             | ${86400000}      | ${"hour"}   | ${24}
    ${0}             | ${86400000}      | ${"day"}    | ${1}
    ${0}             | ${3600000}       | ${"minute"} | ${60}
  `(
    "returns $expected $unit boundaries for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalCountUnix(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start            | end              | unit       | expected
    ${1704067200000} | ${1704240000000} | ${"days"}  | ${2}
    ${1704105000000} | ${1704110400000} | ${"hours"} | ${2}
  `(
    "returns $expected for $start..$end with plural unit $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountUnix(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start              | end                | unit      | expected
    ${"1704067200000"} | ${"1704240000000"} | ${"day"}  | ${2}
    ${"0"}             | ${"86400000"}      | ${"hour"} | ${24}
  `(
    "returns $expected for numeric-string input $start..$end counted in $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountUnix(start, end, unit)).toBe(expected);
    },
  );

  it.each`
    start            | end              | unit      | expected
    ${1704067200000} | ${1704067200000} | ${"day"}  | ${0}
    ${1704085200000} | ${1704085200000} | ${"day"}  | ${1}
    ${0}             | ${0}             | ${"hour"} | ${0}
    ${1800000}       | ${1800000}       | ${"hour"} | ${1}
  `(
    "returns $expected for zero-length $start..$end counted in $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalCountUnix(start, end, unit)).toBe(expected);
    },
  );

  it("returns 23 hour boundaries for the spring-forward local day in America/New_York", () => {
    timeZoneSpy.mockReturnValue("America/New_York");

    expect(intervalCountUnix(1710046800000, 1710129600000, "hour")).toBe(23);
  });

  it("counts calendar units in the system timeZone for every battleTestTimeZone", () => {
    for (const timeZone of battleTestTimeZones) {
      timeZoneSpy.mockReturnValue(timeZone);

      const start = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 6,
        day: 15,
        hour: 0,
        timeZone,
      }).epochMilliseconds;
      const end = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 6,
        day: 16,
        hour: 0,
        timeZone,
      }).epochMilliseconds;

      expect(
        intervalCountUnix(start, end, "hour"),
        `hour count in ${timeZone}`,
      ).toBe(24);
      expect(
        intervalCountUnix(start, end, "day"),
        `day count in ${timeZone}`,
      ).toBe(1);
    }
  });

  it.each`
    start             | end         | unit
    ${NaN}            | ${86400000} | ${"hour"}
    ${Infinity}       | ${86400000} | ${"hour"}
    ${-Infinity}      | ${86400000} | ${"hour"}
    ${1.5}            | ${86400000} | ${"hour"}
    ${0}              | ${NaN}      | ${"hour"}
    ${0}              | ${Infinity} | ${"hour"}
    ${0}              | ${1.5}      | ${"hour"}
    ${"not-a-number"} | ${86400000} | ${"hour"}
    ${86400000}       | ${0}        | ${"hour"}
    ${0}              | ${86400000} | ${"invalid"}
    ${0}              | ${86400000} | ${""}
    ${0}              | ${86400000} | ${"quarter"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalCountUnix(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start        | end          | unit
    ${null}      | ${86400000}  | ${"hour"}
    ${undefined} | ${86400000}  | ${"hour"}
    ${true}      | ${86400000}  | ${"hour"}
    ${[]}        | ${86400000}  | ${"hour"}
    ${{}}        | ${86400000}  | ${"hour"}
    ${0}         | ${null}      | ${"hour"}
    ${0}         | ${undefined} | ${"hour"}
    ${0}         | ${true}      | ${"hour"}
    ${0}         | ${[]}        | ${"hour"}
    ${0}         | ${{}}        | ${"hour"}
    ${0}         | ${86400000}  | ${null}
    ${0}         | ${86400000}  | ${undefined}
    ${0}         | ${86400000}  | ${123}
    ${0}         | ${86400000}  | ${true}
    ${0}         | ${86400000}  | ${[]}
    ${0}         | ${86400000}  | ${{}}
  `(
    "returns null for non-number or non-string input: $start, $end, $unit",
    ({ start, end, unit }) => {
      expect(
        intervalCountUnix(start as never, end as never, unit as never),
      ).toBeNull();
    },
  );

  it("returns null when the system timeZone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");

    expect(intervalCountUnix(0, 86400000, "hour")).toBeNull();
  });
});
