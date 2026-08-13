import { Temporal } from "@js-temporal/polyfill";
import { mockSystemTimeZone } from "../../test/timeZoneMatrix";
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

  it("returns null when Temporal.Instant.fromEpochMilliseconds throws", () => {
    vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(
      () => {
        throw new Error("simulated failure");
      },
    );
    expect(roundUnix(1706780800000, { smallestUnit: "hour" })).toBeNull();
  });
});
