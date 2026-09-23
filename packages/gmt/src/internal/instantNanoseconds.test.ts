import { mockTemporalInstantFromThrow } from "../test/mocks";
import { parseInstantNanoseconds } from "./instantNanoseconds";

describe("parseInstantNanoseconds", () => {
  it.each`
    value                                            | expected
    ${"1970-01-01T00:00:00Z"}                        | ${0n}
    ${"1969-12-31T23:59:59Z"}                        | ${-1000000000n}
    ${"2024-03-10T12:00:00.123456789Z"}              | ${1710072000123456789n}
    ${"2024-03-10T12:00:00-05:00"}                   | ${1710090000000000000n}
    ${"2024-03-10T12:00:00-05:00[America/New_York]"} | ${1710090000000000000n}
    ${"2024-03-10T12:00-05:00:00.5"}                 | ${1710090000500000000n}
    ${"2024-03-10T12:00:00,5Z"}                      | ${1710072000500000000n}
    ${"+275760-09-13T00:00:00Z"}                     | ${8640000000000000000000n}
    ${"-271821-04-20T00:00:00Z"}                     | ${-8640000000000000000000n}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseInstantNanoseconds(value)).toBe(expected);
  });

  it("distinguishes the epoch from a rejected string, which is the point of returning null", () => {
    expect(parseInstantNanoseconds("1970-01-01T00:00:00Z")).toBe(0n);
    expect(parseInstantNanoseconds("invalid")).toBeNull();
  });

  it.each`
    value                                            | reason
    ${"2024-03-10"}                                  | ${"date-only, no offset"}
    ${"2024-03-10T12:00:00"}                         | ${"no offset designator"}
    ${"12:00:00Z"}                                   | ${"time-only"}
    ${"2024-13-10T12:00:00Z"}                        | ${"month out of range"}
    ${"2024-02-30T12:00:00Z"}                        | ${"day out of range"}
    ${"+275760-09-13T00:00:00.001Z"}                 | ${"past the representable range"}
    ${"-271821-04-19T23:59:59Z"}                     | ${"before the representable range"}
    ${"2016-12-31T23:59:60Z"}                        | ${"leap second"}
    ${"2016-12-31T23:59:60.500Z"}                    | ${"fractional leap second"}
    ${"2016-12-31t23:59:60Z"}                        | ${"leap second, lowercase t separator"}
    ${"2016-12-31 23:59:60Z"}                        | ${"leap second, space separator"}
    ${"2016-12-31T23:59:60z"}                        | ${"leap second, lowercase z"}
    ${"20161231T235960Z"}                            | ${"leap second, basic format"}
    ${"2016-12-31T235960Z"}                          | ${"leap second, basic-format time"}
    ${"20161231 235960Z"}                            | ${"leap second, basic format and space"}
    ${"2016-12-31T23:59:60+00:00"}                   | ${"leap second with numeric offset"}
    ${"2016-12-31T23:59:60-05:00[America/New_York]"} | ${"leap second in a zoned string"}
    ${"2024-03-10 12:00:00Z"}                        | ${"space separator (strict extended shape)"}
    ${"2024-03-10t12:00:00Z"}                        | ${"lower-case t separator (strict extended shape)"}
    ${"2024-03-10T12:00:00z"}                        | ${"lower-case z designator (strict extended shape)"}
    ${"20240310T120000Z"}                            | ${"basic format (strict extended shape)"}
    ${"2024-03-10T07:00:00-0500"}                    | ${"basic offset (strict extended shape)"}
    ${"2024-03-10T07:00:00-05"}                      | ${"hour-only offset (strict extended shape)"}
    ${"2024-03-10T12Z"}                              | ${"hour-only time (strict extended shape)"}
    ${"invalid"}                                     | ${"unparseable"}
    ${""}                                            | ${"empty string"}
  `("returns null when $value is invalid ($reason)", ({ value }) => {
    expect(parseInstantNanoseconds(value)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${1710072000123456789n}
    ${true}
    ${[]}
    ${{}}
  `("returns null when $value is non-string input", ({ value }) => {
    expect(parseInstantNanoseconds(value as unknown as string)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(parseInstantNanoseconds("2024-03-10T12:00:00Z")).toBeNull();
  });

  // Temporal.Instant.from reads RFC 9557 annotations and ignores a time zone, calendar or elective
  // annotation (an instant has no calendar; proposal-temporal `ParseTemporalInstantString`), and
  // rejects an unknown critical one. Native Temporal (Chromium 153) agrees.
  it.each`
    value                                            | expected
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"}      | ${1_710_090_000_000_000_000n}
    ${"2024-03-10T12:00:00-05:00[!u-ca=hebrew]"}     | ${1_710_090_000_000_000_000n}
    ${"2024-03-10T17:00:00Z[foo=bar]"}               | ${1_710_090_000_000_000_000n}
    ${"2024-03-10T17:00:00Z[Europe/Paris][foo=bar]"} | ${1_710_090_000_000_000_000n}
    ${"2024-03-10T17:00:00Z[!foo=bar]"}              | ${null}
    ${"2024-03-10T17:00:00Z[foo=bar][Europe/Paris]"} | ${null}
  `(
    "reads the annotations of $value as Temporal does → $expected",
    ({ value, expected }) => {
      expect(parseInstantNanoseconds(value)).toBe(expected);
    },
  );
});
