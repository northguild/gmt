import { Temporal } from "@js-temporal/polyfill";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../test/mocks";
import {
  formatTimeScaleString,
  parseTimeScaleString,
  timeScaleString,
} from "./timeScaleString";

/** Label nanoseconds: a scale's wall clock read as if UTC. */
function labelNs(wall: string): bigint {
  return Temporal.PlainDateTime.from(wall).toZonedDateTime("UTC")
    .epochNanoseconds;
}

describe("timeScaleString", () => {
  // FITS 4.0 Table 30 (TAI) and the six RINEX 4.02 §5.2.8 time-system identifiers.
  it.each`
    token
    ${"TAI"}
    ${"GPS"}
    ${"GAL"}
    ${"BDT"}
    ${"QZS"}
    ${"GLO"}
    ${"IRN"}
  `("matches a date-time followed by one space and $token", ({ token }) => {
    expect(timeScaleString.test(`2026-01-01T00:00:37 ${token}`)).toBe(true);
  });

  it.each`
    value
    ${"2026-01-01T00:00:37 UTC"}
    ${"2026-01-01T00:00:37 BDS"}
    ${"2026-01-01T00:00:37 tai"}
  `("does not match the token in $value", ({ value }) => {
    expect(timeScaleString.test(value)).toBe(false);
  });
});

describe("parseTimeScaleString", () => {
  it.each`
    value                                  | token    | wall
    ${"2026-01-01T00:00:37 TAI"}           | ${"TAI"} | ${"2026-01-01T00:00:37"}
    ${"2026-01-01T00:00:37.5 TAI"}         | ${"TAI"} | ${"2026-01-01T00:00:37.5"}
    ${"2026-01-01T00:00:37.000000001 TAI"} | ${"TAI"} | ${"2026-01-01T00:00:37.000000001"}
    ${"2026-01-01T00:00:37.100 TAI"}       | ${"TAI"} | ${"2026-01-01T00:00:37.1"}
    ${"2026-01-01T00:00:37.123456789 TAI"} | ${"TAI"} | ${"2026-01-01T00:00:37.123456789"}
    ${"9999-12-31T23:59:59.999999999 TAI"} | ${"TAI"} | ${"9999-12-31T23:59:59.999999999"}
    ${"0000-01-01T00:00:00 TAI"}           | ${"TAI"} | ${"0000-01-01T00:00:00"}
    ${"2024-01-01T00:00:18 GPS"}           | ${"GPS"} | ${"2024-01-01T00:00:18"}
    ${"2024-01-01T00:00:00 GLO"}           | ${"GLO"} | ${"2024-01-01T00:00:00"}
  `(
    "reads $value with token $token as the wall clock $wall",
    ({ value, token, wall }) => {
      expect(parseTimeScaleString(value, token)).toEqual({
        labelNanoseconds: labelNs(wall),
        secondSixty: false,
      });
    },
  );

  // GLO is UTC's own wall clock, leap seconds included (RINEX 4.02 §4.1.2): its second 60 is read
  // as 59 with a flag, and whether that second was inserted is decided later.
  it.each`
    value                           | wall
    ${"2016-12-31T23:59:60 GLO"}    | ${"2016-12-31T23:59:59"}
    ${"2016-12-31T23:59:60.25 GLO"} | ${"2016-12-31T23:59:59.25"}
    ${"2017-12-31T23:59:60 GLO"}    | ${"2017-12-31T23:59:59"}
  `(
    "reads the GLO second 60 in $value as $wall with secondSixty true",
    ({ value, wall }) => {
      expect(parseTimeScaleString(value, "GLO")).toEqual({
        labelNanoseconds: labelNs(wall),
        secondSixty: true,
      });
    },
  );

  it.each`
    value                                   | token    | why
    ${"2016-12-31T23:59:60 TAI"}            | ${"TAI"} | ${"TAI is continuous: no second 60"}
    ${"2016-12-31T23:59:60 GPS"}            | ${"GPS"} | ${"GPS is continuous: no second 60"}
    ${"2016-12-31T23:59:61 GLO"}            | ${"GLO"} | ${"second 61"}
    ${"2024-01-01T00:00:18 GPS"}            | ${"TAI"} | ${"wrong token"}
    ${"2024-01-01T00:00:18 TAI"}            | ${"GPS"} | ${"wrong token"}
    ${"2026-02-30T00:00:37 TAI"}            | ${"TAI"} | ${"no such date"}
    ${"2026-01-01T24:00:00 TAI"}            | ${"TAI"} | ${"hour 24"}
    ${"2026-01-01T00:60:00 TAI"}            | ${"TAI"} | ${"minute 60"}
    ${"2026-01-01t00:00:37 TAI"}            | ${"TAI"} | ${"lower-case t"}
    ${"2026-01-01T00:00:37,5 TAI"}          | ${"TAI"} | ${"comma fraction"}
    ${"2026-01-01T00:00:37.1234567890 TAI"} | ${"TAI"} | ${"ten fraction digits"}
    ${"+002026-01-01T00:00:37 TAI"}         | ${"TAI"} | ${"expanded year"}
    ${"2026-01-01T00:00:37  TAI"}           | ${"TAI"} | ${"two spaces"}
  `("returns null for $value with token $token ($why)", ({ value, token }) => {
    expect(parseTimeScaleString(value, token)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
  `("returns null for the non-string $value", ({ value }) => {
    expect(parseTimeScaleString(value, "TAI")).toBeNull();
  });

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(parseTimeScaleString("2026-01-01T00:00:37 TAI", "TAI")).toBeNull();
  });
});

describe("formatTimeScaleString", () => {
  it.each`
    wall                               | token    | expected
    ${"2026-01-01T00:00:37"}           | ${"TAI"} | ${"2026-01-01T00:00:37 TAI"}
    ${"2026-01-01T00:00:37.5"}         | ${"TAI"} | ${"2026-01-01T00:00:37.5 TAI"}
    ${"2026-01-01T00:00:00"}           | ${"GPS"} | ${"2026-01-01T00:00:00 GPS"}
    ${"9999-12-31T23:59:59.999999999"} | ${"TAI"} | ${"9999-12-31T23:59:59.999999999 TAI"}
    ${"0000-01-01T00:00:00"}           | ${"TAI"} | ${"0000-01-01T00:00:00 TAI"}
  `(
    "writes the label $wall with token $token as $expected",
    ({ wall, token, expected }) => {
      expect(
        formatTimeScaleString(
          { labelNanoseconds: labelNs(wall), secondSixty: false },
          token,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    wall                        | expected
    ${"2016-12-31T23:59:59"}    | ${"2016-12-31T23:59:60 GLO"}
    ${"2016-12-31T23:59:59.25"} | ${"2016-12-31T23:59:60.25 GLO"}
  `(
    "writes the second-60 label at $wall as $expected",
    ({ wall, expected }) => {
      expect(
        formatTimeScaleString(
          { labelNanoseconds: labelNs(wall), secondSixty: true },
          "GLO",
        ),
      ).toBe(expected);
    },
  );

  // GMT rule: four-digit years only, 0000 to 9999.
  it.each`
    wall                                  | why
    ${"+010000-01-01T00:00:00"}           | ${"year 10000"}
    ${"-000001-12-31T23:59:59.999999999"} | ${"year -1"}
  `("returns an empty string for the label $wall ($why)", ({ wall }) => {
    expect(
      formatTimeScaleString(
        { labelNanoseconds: labelNs(wall), secondSixty: false },
        "TAI",
      ),
    ).toBe("");
  });

  it("returns an empty string when Temporal.PlainTime.from throws while writing second 60", () => {
    mockTemporalPlainTimeFromThrow();
    expect(
      formatTimeScaleString(
        { labelNanoseconds: labelNs("2016-12-31T23:59:59"), secondSixty: true },
        "GLO",
      ),
    ).toBe("");
  });

  it("returns an empty string when Temporal.Instant.fromEpochNanoseconds throws", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(
      formatTimeScaleString(
        {
          labelNanoseconds: labelNs("2026-01-01T00:00:37"),
          secondSixty: false,
        },
        "TAI",
      ),
    ).toBe("");
  });
});
