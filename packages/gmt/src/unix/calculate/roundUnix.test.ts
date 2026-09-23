import { Temporal } from "@js-temporal/polyfill";
import {
  dateLineCrossingAt,
  dateLineCrossingTimeZones,
  mockSystemTimeZone,
} from "../../test/timeZoneMatrix";
import { roundUnix } from "./roundUnix";

describe("roundUnix", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = mockSystemTimeZone("UTC");
  });

  afterEach(() => {
    cleanup();
  });

  // happy path: all supported units with default rounding
  it.each`
    value            | unit             | expected
    ${1706780800000} | ${"day"}         | ${1706745600000}
    ${1706780800000} | ${"hour"}        | ${1706781600000}
    ${1706780800000} | ${"minute"}      | ${1706780820000}
    ${1706780800000} | ${"second"}      | ${1706780800000}
    ${1706780800123} | ${"millisecond"} | ${1706780800123}
  `(
    "returns $expected for value $value rounded to $unit",
    ({ value, unit, expected }) => {
      expect(roundUnix(value, { smallestUnit: unit })).toBe(expected);
    },
  );

  // rounding modes
  it.each`
    value            | unit        | roundingMode | expected
    ${1706780800000} | ${"hour"}   | ${"floor"}   | ${1706778000000}
    ${1706780800000} | ${"hour"}   | ${"ceil"}    | ${1706781600000}
    ${1706780800000} | ${"hour"}   | ${"expand"}  | ${1706781600000}
    ${1706780800000} | ${"hour"}   | ${"trunc"}   | ${1706778000000}
    ${1706780800000} | ${"minute"} | ${"floor"}   | ${1706780760000}
    ${1706780800000} | ${"minute"} | ${"ceil"}    | ${1706780820000}
  `(
    "returns $expected for value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundUnix(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  // rounding increments
  it.each`
    value            | unit        | roundingIncrement | expected
    ${1706780800000} | ${"minute"} | ${15}             | ${1706780700000}
    ${1706780800000} | ${"hour"}   | ${2}              | ${1706781600000}
  `(
    "returns $expected for value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement, expected }) => {
      expect(roundUnix(value, { smallestUnit: unit, roundingIncrement })).toBe(
        expected,
      );
    },
  );

  // zero and negative roundingIncrement return null
  it.each`
    value            | unit        | roundingIncrement
    ${1706780800000} | ${"minute"} | ${0}
    ${1706780800000} | ${"hour"}   | ${-1}
  `(
    "returns null for value with roundingIncrement $roundingIncrement on $unit",
    ({ value, unit, roundingIncrement }) => {
      expect(
        roundUnix(value, { smallestUnit: unit, roundingIncrement }),
      ).toBeNull();
    },
  );

  // epochUnit: seconds
  it.each`
    value         | unit        | expected
    ${1706780800} | ${"day"}    | ${1706745600}
    ${1706780800} | ${"hour"}   | ${1706781600}
    ${1706780800} | ${"minute"} | ${1706780820}
  `(
    "returns $expected for value $value (seconds) rounded to $unit",
    ({ value, unit, expected }) => {
      expect(
        roundUnix(value, { smallestUnit: unit, epochUnit: "seconds" }),
      ).toBe(expected);
    },
  );

  // custom timeZone
  it.each`
    value            | unit      | timeZone              | expected
    ${1706780800000} | ${"day"}  | ${"America/New_York"} | ${1706763600000}
    ${1706780800000} | ${"hour"} | ${"America/New_York"} | ${1706781600000}
  `(
    "returns $expected for value with timeZone $timeZone rounded to $unit",
    ({ value, unit, timeZone, expected }) => {
      expect(roundUnix(value, { smallestUnit: unit, timeZone })).toBe(expected);
    },
  );

  // invalid inputs
  it.each`
    invalidValue
    ${"invalid"}
    ${1.5}
    ${null}
    ${undefined}
  `("returns null for invalid value $invalidValue", ({ invalidValue }) => {
    expect(
      roundUnix(invalidValue as never, { smallestUnit: "day" as never }),
    ).toBeNull();
  });

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      roundUnix(1706780800000, { smallestUnit: invalidUnit as never }),
    ).toBeNull();
  });

  // unsupported date units (year, month, week) return null
  it.each`
    unit
    ${"year"}
    ${"month"}
    ${"week"}
  `("returns null for unsupported date unit $unit", ({ unit }) => {
    expect(
      roundUnix(1706780800000, { smallestUnit: unit as never }),
    ).toBeNull();
  });

  // negative timestamps
  it.each`
    value        | unit      | expected
    ${-86400000} | ${"day"}  | ${-86400000}
    ${-86400000} | ${"hour"} | ${-86400000}
  `(
    "returns $expected for negative timestamp $value rounded to $unit",
    ({ value, unit, expected }) => {
      expect(roundUnix(value, { smallestUnit: unit })).toBe(expected);
    },
  );

  // exact boundary cases
  it.each`
    value            | unit      | roundingMode    | expected
    ${1706780800000} | ${"hour"} | ${"halfExpand"} | ${1706781600000}
    ${1706779200000} | ${"hour"} | ${"halfExpand"} | ${1706778000000}
  `(
    "returns $expected for boundary value with roundingMode $roundingMode on $unit",
    ({ value, unit, roundingMode, expected }) => {
      expect(roundUnix(value, { smallestUnit: unit, roundingMode })).toBe(
        expected,
      );
    },
  );

  // Pins TC39 ZonedDateTime.round: it rounds the wall clock and re-resolves, so across a
  // transition a "trunc" result can land after the input (Chatham) or an hour early (Goose_Bay).
  it.each`
    value            | timeZone               | smallestUnit | roundingMode | expected
    ${1727532300000} | ${"Pacific/Chatham"}   | ${"hour"}    | ${"trunc"}   | ${1727532900000}
    ${1289100600000} | ${"America/Goose_Bay"} | ${"hour"}    | ${"trunc"}   | ${1289095200000}
    ${1289100600000} | ${"America/Goose_Bay"} | ${"day"}     | ${"trunc"}   | ${1289098800000}
  `(
    "follows TC39 round for $value in $timeZone to $smallestUnit with $roundingMode, giving $expected",
    ({ value, timeZone, smallestUnit, roundingMode, expected }) => {
      expect(roundUnix(value, { smallestUnit, roundingMode, timeZone })).toBe(
        expected,
      );
    },
  );

  it("returns null when Temporal.Instant.fromEpochMilliseconds throws", () => {
    vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(
      () => {
        throw new Error("simulated failure");
      },
    );
    expect(roundUnix(1706780800000, { smallestUnit: "hour" })).toBeNull();
  });
});

describe("roundUnix at the maximum instant", () => {
  // 8_639_999_998_200_000 ms is 09:30 in Sydney; halfExpand to the hour gives 10:00, the maximum.
  it.each`
    value                    | smallestUnit | timeZone              | expected
    ${8_639_999_998_200_000} | ${"hour"}    | ${"Australia/Sydney"} | ${8_640_000_000_000_000}
  `(
    "rounds $value to the $smallestUnit in $timeZone giving $expected",
    ({ value, smallestUnit, timeZone, expected }) => {
      expect(roundUnix(value, { smallestUnit, timeZone })).toBe(expected);
    },
  );
});

describe("roundUnix with an unrecognised epochUnit", () => {
  // isValidUnixUnit defines the domain ("seconds" | "milliseconds", singular or plural): any other value is invalid
  // input and returns the sentinel, never a silent read as milliseconds.
  it.each`
    epochUnit
    ${"nanoseconds"}
    ${"SECONDS"}
    ${"ms"}
    ${""}
    ${1000}
  `("returns null for epochUnit $epochUnit", ({ epochUnit }) => {
    expect(
      roundUnix(1_706_659_200, {
        smallestUnit: "day",
        epochUnit: epochUnit as never,
        timeZone: "UTC",
      }),
    ).toBe(null);
  });
});

describe("roundUnix with a plural smallestUnit", () => {
  // Temporal §13.17 GetTemporalUnitValuedOption: "Both singular and plural unit names are accepted".
  // 1715779905500 is 2024-05-15T13:31:45.5Z; expected values from polyfill ZonedDateTime.round in
  // UTC (halfExpand): past noon rounds up a day, 31 minutes up an hour, 45.5 s up a minute, and
  // the .5 s tie up a second.
  it.each`
    unit              | epochUnit         | value            | expected
    ${"days"}         | ${"milliseconds"} | ${1715779905500} | ${1715817600000}
    ${"hours"}        | ${"milliseconds"} | ${1715779905500} | ${1715781600000}
    ${"minutes"}      | ${"milliseconds"} | ${1715779905500} | ${1715779920000}
    ${"seconds"}      | ${"milliseconds"} | ${1715779905500} | ${1715779906000}
    ${"milliseconds"} | ${"milliseconds"} | ${1715779905500} | ${1715779905500}
    ${"microseconds"} | ${"milliseconds"} | ${1715779905500} | ${1715779905500}
    ${"nanoseconds"}  | ${"milliseconds"} | ${1715779905500} | ${1715779905500}
    ${"days"}         | ${"seconds"}      | ${1715779905}    | ${1715817600}
  `(
    "returns $expected for $value ($epochUnit) rounded to the plural unit $unit in UTC",
    ({ unit, epochUnit, value, expected }) => {
      expect(
        roundUnix(value, { smallestUnit: unit, epochUnit, timeZone: "UTC" }),
      ).toBe(expected);
    },
  );

  // Temporal ZonedDateTime.prototype.round throws RangeError for weeks, months and years, in
  // either spelling.
  it.each`
    unit
    ${"weeks"}
    ${"months"}
    ${"years"}
    ${"dayss"}
    ${"s"}
  `("returns null for the unsupported unit $unit", ({ unit }) => {
    expect(
      roundUnix(1715779905500, {
        smallestUnit: unit as never,
        timeZone: "UTC",
      }),
    ).toBeNull();
  });
});

// The 1844 date-line crossings (zoned.E): Asia/Manila, Pacific/Guam, Saipan, Kosrae and Palau
// skipped 1844-12-31, jumping a whole day forward at local 1844-12-31T00:00 in LMT. Expected values
// are Chromium 153 native Temporal, never the polyfill (whose transition search starts at
// 1847-01-01). `dateLineCrossingAt(zone, h)` is the zone h hours from its crossing, from exact time.

describe("roundUnix across the 1844 date-line crossings (zoned.E)", () => {
  it.each(dateLineCrossingTimeZones)(
    "rounds noon of 1844-12-30 in $timeZone to the crossing, $instant",
    (crossing) => {
      expect(
        roundUnix(dateLineCrossingAt(crossing, -12).epochMilliseconds, {
          smallestUnit: "day",
          timeZone: crossing.timeZone,
        }),
      ).toBe(dateLineCrossingAt(crossing, 0).epochMilliseconds);
    },
  );
});
