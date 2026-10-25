import { Temporal } from "./temporal";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalInstantFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../test/mocks";
import {
  formatUtcReading,
  parseUtcReading,
  subsecondFraction,
} from "./utcReading";

function utcNs(iso: string): bigint {
  return Temporal.Instant.from(iso).epochNanoseconds;
}

describe("parseUtcReading", () => {
  it.each`
    value                                      | instant
    ${"2024-01-01T00:00:00Z"}                  | ${"2024-01-01T00:00:00Z"}
    ${"2024-01-01T00:00:00.5Z"}                | ${"2024-01-01T00:00:00.5Z"}
    ${"2024-01-01T09:00:00+09:00[Asia/Tokyo]"} | ${"2024-01-01T00:00:00Z"}
    ${"2016-12-31T23:59:59Z"}                  | ${"2016-12-31T23:59:59Z"}
  `("reads the ordinary instant $value as $instant", ({ value, instant }) => {
    expect(parseUtcReading(value)).toEqual({
      epochNanoseconds: utcNs(instant),
      secondSixty: false,
    });
  });

  // Temporal clamps second 60 to 59 (proposal-temporal ParseISODateTime), so the reading keeps
  // the clamped instant and a flag. Whether a second 60 was inserted is not checked here.
  it.each`
    value                                            | clamped
    ${"2016-12-31T23:59:60Z"}                        | ${"2016-12-31T23:59:59Z"}
    ${"2016-12-31T23:59:60.5Z"}                      | ${"2016-12-31T23:59:59.5Z"}
    ${"2016-12-31T23:59:60,5Z"}                      | ${"2016-12-31T23:59:59.5Z"}
    ${"2016-12-31T23:59:60.123456789Z"}              | ${"2016-12-31T23:59:59.123456789Z"}
    ${"2017-01-01T08:59:60+09:00"}                   | ${"2016-12-31T23:59:59Z"}
    ${"2016-12-31T18:59:60-05:00[America/New_York]"} | ${"2016-12-31T23:59:59Z"}
    ${"2016-12-31T23:59:60Z[u-ca=hebrew]"}           | ${"2016-12-31T23:59:59Z"}
    ${"2016-12-31T12:34:60Z"}                        | ${"2016-12-31T12:34:59Z"}
    ${"2016-12-31T23:59:60-00:00"}                   | ${"2016-12-31T23:59:59Z"}
    ${"2016-12-31T23:59:60+00:00:00"}                | ${"2016-12-31T23:59:59Z"}
    ${"2016-12-31T23:59:60Z[UTC]"}                   | ${"2016-12-31T23:59:59Z"}
    ${"2016-12-31T11:59:60-12:00"}                   | ${"2016-12-31T23:59:59Z"}
  `(
    "reads the second-60 string $value as $clamped with secondSixty true",
    ({ value, clamped }) => {
      expect(parseUtcReading(value)).toEqual({
        epochNanoseconds: utcNs(clamped),
        secondSixty: true,
      });
    },
  );

  it.each`
    value                                | why
    ${"20161231T235960Z"}                | ${"basic format"}
    ${"2016-12-31t23:59:60Z"}            | ${"lower-case t"}
    ${"2016-12-31 23:59:60Z"}            | ${"space separator"}
    ${"2016-12-31T23:59:60z"}            | ${"lower-case z"}
    ${"2016-12-31T23:59:60"}             | ${"no designator"}
    ${"2016-12-31T23:59:60+0900"}        | ${"basic offset"}
    ${"2017-01-01T08:59:60+09"}          | ${"an hour-only offset"}
    ${"2016-12-31T23:59:60.1234567890Z"} | ${"ten fraction digits"}
    ${"2016-12-31T23:59:60.Z"}           | ${"empty fraction"}
    ${"2016-12-31T24:59:60Z"}            | ${"hour 24"}
    ${"2016-12-31T23:60:60Z"}            | ${"minute 60"}
    ${"2016-12-31T23:59:61Z"}            | ${"second 61"}
    ${"2016-02-30T23:59:60Z"}            | ${"no such date"}
    ${"2016-12-31T23:59:60Z[!foo=bar]"}  | ${"unknown critical annotation"}
    ${"2024-01-01"}                      | ${"date only"}
    ${"x"}                               | ${"not a date"}
  `("returns null for $value ($why)", ({ value }) => {
    expect(parseUtcReading(value)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${{}}
  `("returns null for the non-string $value", ({ value }) => {
    expect(parseUtcReading(value)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws on the second-60 path", () => {
    mockTemporalInstantFromThrow();
    expect(parseUtcReading("2016-12-31T23:59:60Z")).toBeNull();
  });
});

describe("formatUtcReading", () => {
  it.each`
    instant                     | expected
    ${"2024-01-01T00:00:00Z"}   | ${"2024-01-01T00:00:00Z"}
    ${"2026-01-01T00:00:00.5Z"} | ${"2026-01-01T00:00:00.5Z"}
    ${"2016-12-31T23:59:59Z"}   | ${"2016-12-31T23:59:59Z"}
  `(
    "writes the ordinary reading $instant as $expected",
    ({ instant, expected }) => {
      expect(
        formatUtcReading({
          epochNanoseconds: utcNs(instant),
          secondSixty: false,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    clamped                             | expected
    ${"2016-12-31T23:59:59Z"}           | ${"2016-12-31T23:59:60Z"}
    ${"2016-12-31T23:59:59.5Z"}         | ${"2016-12-31T23:59:60.5Z"}
    ${"2016-12-31T23:59:59.1Z"}         | ${"2016-12-31T23:59:60.1Z"}
    ${"2016-12-31T23:59:59.123456789Z"} | ${"2016-12-31T23:59:60.123456789Z"}
    ${"2016-12-31T23:59:59.999999999Z"} | ${"2016-12-31T23:59:60.999999999Z"}
    ${"1972-06-30T23:59:59Z"}           | ${"1972-06-30T23:59:60Z"}
  `(
    "writes the second-60 reading at $clamped as $expected",
    ({ clamped, expected }) => {
      expect(
        formatUtcReading({
          epochNanoseconds: utcNs(clamped),
          secondSixty: true,
        }),
      ).toBe(expected);
    },
  );

  // GMT rule: this realm writes four-digit years only (the same limit as its scale strings).
  it.each`
    instant                             | expected
    ${"9999-12-31T23:59:59.999999999Z"} | ${"9999-12-31T23:59:59.999999999Z"}
    ${"+010000-01-01T00:00:00Z"}        | ${""}
    ${"+275760-09-13T00:00:00Z"}        | ${""}
  `(
    "writes $instant as '$expected' (four-digit years only)",
    ({ instant, expected }) => {
      expect(
        formatUtcReading({
          epochNanoseconds: utcNs(instant),
          secondSixty: false,
        }),
      ).toBe(expected);
    },
  );

  it("returns an empty string for an instant past Temporal's range", () => {
    expect(
      formatUtcReading({
        epochNanoseconds: utcNs("+275760-09-13T00:00:00Z") + 1n,
        secondSixty: false,
      }),
    ).toBe("");
  });

  it.each`
    secondSixty
    ${false}
    ${true}
  `(
    "returns an empty string when Temporal.Instant.fromEpochNanoseconds throws (secondSixty $secondSixty)",
    ({ secondSixty }) => {
      mockTemporalInstantFromEpochNanosecondsThrow();
      expect(
        formatUtcReading({
          epochNanoseconds: utcNs("2016-12-31T23:59:59Z"),
          secondSixty,
        }),
      ).toBe("");
    },
  );

  it("returns an empty string when Temporal.PlainTime.from throws while writing second 60", () => {
    mockTemporalPlainTimeFromThrow();
    expect(
      formatUtcReading({
        epochNanoseconds: utcNs("2016-12-31T23:59:59Z"),
        secondSixty: true,
      }),
    ).toBe("");
  });
});

describe("subsecondFraction", () => {
  // RFC 3339 §5.6 time-secfrac, written with Temporal's automatic digits: shortest, no trailing zeros.
  it.each`
    nanoseconds                   | expected
    ${0n}                         | ${""}
    ${500_000_000n}               | ${".5"}
    ${100_000_000n}               | ${".1"}
    ${120_000_000n}               | ${".12"}
    ${123_456_789n}               | ${".123456789"}
    ${1n}                         | ${".000000001"}
    ${999_999_999n}               | ${".999999999"}
    ${1_483_228_799_500_000_000n} | ${".5"}
    ${-1n}                        | ${".999999999"}
  `(
    "writes the fraction of the second $nanoseconds falls in as '$expected'",
    ({ nanoseconds, expected }) => {
      expect(subsecondFraction(nanoseconds)).toBe(expected);
    },
  );
});
