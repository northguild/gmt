import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { intervalLengthUnix } from "./intervalLengthUnix";

// Epoch values used below, in ISO 8601 UTC:
// 0             is 1970-01-01T00:00:00Z
// 1704067200000 is 2024-01-01T00:00:00Z
// 1704153540000 is 2024-01-01T23:59:00Z
// 1704153660000 is 2024-01-02T00:01:00Z
// 1709596800000 is 2024-03-05T00:00:00Z
// 1735689600000 is 2025-01-01T00:00:00Z
// 1710046800000 is 2024-03-10T00:00:00-05:00[America/New_York]
// 1710129600000 is 2024-03-11T00:00:00-04:00[America/New_York]

describe("intervalLengthUnix", () => {
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
    ${0}             | ${86400000}      | ${"hour"}   | ${24}
    ${0}             | ${5400000}       | ${"hour"}   | ${1.5}
    ${1704153540000} | ${1704153660000} | ${"day"}    | ${2 / 1440}
    ${1704153540000} | ${1704153660000} | ${"minute"} | ${2}
    ${1704067200000} | ${1709596800000} | ${"month"}  | ${2.129032258064516}
    ${1704067200000} | ${1735689600000} | ${"year"}   | ${1}
  `(
    "returns $expected $unit for $start..$end in the system timeZone",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthUnix(start, end, unit)).toBeCloseTo(expected, 9);
    },
  );

  it.each`
    start              | end                | unit      | expected
    ${"0"}             | ${"86400000"}      | ${"hour"} | ${24}
    ${"1704067200000"} | ${"1709596800000"} | ${"day"}  | ${64}
  `(
    "returns $expected for numeric-string input $start..$end in $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthUnix(start, end, unit)).toBeCloseTo(expected, 9);
    },
  );

  it.each`
    start       | end         | unit
    ${0}        | ${0}        | ${"hour"}
    ${86400000} | ${86400000} | ${"day"}
  `(
    "returns 0 for zero-length $start..$end in $unit",
    ({ start, end, unit }) => {
      expect(intervalLengthUnix(start, end, unit)).toBe(0);
    },
  );

  it("returns exactly 23 real hours across a spring-forward day in America/New_York", () => {
    timeZoneSpy.mockReturnValue("America/New_York");

    expect(intervalLengthUnix(1710046800000, 1710129600000, "hour")).toBe(23);
  });

  it("returns exactly 1 calendar day for a spring-forward day even though it is 23 real hours", () => {
    timeZoneSpy.mockReturnValue("America/New_York");

    expect(intervalLengthUnix(1710046800000, 1710129600000, "day")).toBe(1);
  });

  it("proves zone-invariance across battleTestTimeZones for a fixed real-time span measured in hours", () => {
    const startInstant = Temporal.Instant.from("2024-06-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-06-01T05:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      timeZoneSpy.mockReturnValue(timeZone);

      expect(
        intervalLengthUnix(
          startInstant.epochMilliseconds,
          endInstant.epochMilliseconds,
          "hour",
        ),
        `hour length in ${timeZone}`,
      ).toBe(5);
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
      expect(intervalLengthUnix(start, end, unit)).toBeNull();
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
        intervalLengthUnix(start as never, end as never, unit as never),
      ).toBeNull();
    },
  );

  it("returns null when the system timeZone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");

    expect(intervalLengthUnix(0, 86400000, "hour")).toBeNull();
  });
});
