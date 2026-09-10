import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import { fromNtpTimestamp } from "./fromNtpTimestamp";
import { toNtpTimestamp } from "./toNtpTimestamp";

describe("fromNtpTimestamp", () => {
  it.each`
    value                    | expected                            | reason
    ${0n}                    | ${"1900-01-01T00:00:00Z"}           | ${"the NTP epoch"}
    ${4294967296n}           | ${"1900-01-01T00:00:01Z"}           | ${"one whole second, fraction zero"}
    ${2147483648n}           | ${"1900-01-01T00:00:00.5Z"}         | ${"half a second, the top fraction bit"}
    ${9487534653230284800n}  | ${"1970-01-01T00:00:00Z"}           | ${"the Unix epoch"}
    ${9487534648935317504n}  | ${"1969-12-31T23:59:59Z"}           | ${"one second before the Unix epoch"}
    ${16832237967035596800n} | ${"2024-03-10T12:00:00Z"}           | ${"whole second"}
    ${16832246972675778412n} | ${"2024-03-10T12:34:56.789Z"}       | ${"millisecond fraction"}
    ${16832237967565839671n} | ${"2024-03-10T12:00:00.123456789Z"} | ${"nanosecond fraction"}
    ${18446744069414584320n} | ${"2036-02-07T06:28:15Z"}           | ${"the last second of era 0"}
  `(
    "returns $expected for $value in the default era 0 ($reason)",
    ({ value, expected }) => {
      expect(fromNtpTimestamp(value)).toBe(expected);
    },
  );

  it.each`
    value                    | era   | expected
    ${0n}                    | ${0}  | ${"1900-01-01T00:00:00Z"}
    ${0n}                    | ${1}  | ${"2036-02-07T06:28:16Z"}
    ${0n}                    | ${2}  | ${"2172-03-15T12:56:32Z"}
    ${0n}                    | ${-1} | ${"1763-11-24T17:31:44Z"}
    ${18446744069414584320n} | ${-1} | ${"1899-12-31T23:59:59Z"}
    ${18446372988535177216n} | ${-1} | ${"1899-12-31T00:00:00Z"}
    ${18446372988535177216n} | ${0}  | ${"2036-02-06T06:28:16Z"}
    ${14815133583223554048n} | ${-3} | ${"1601-01-01T00:00:00Z"}
  `("returns $expected for $value in era $era", ({ value, era, expected }) => {
    expect(fromNtpTimestamp(value, era)).toBe(expected);
  });

  it("resolves the same value to a different instant in every era", () => {
    expect(fromNtpTimestamp(0n)).toBe("1900-01-01T00:00:00Z");
    expect(fromNtpTimestamp(0n, 0)).toBe("1900-01-01T00:00:00Z");
    expect(fromNtpTimestamp(0n, 1)).not.toBe(fromNtpTimestamp(0n, 0));
  });

  it.each`
    value                               | reason
    ${"1900-01-01T00:00:00Z"}           | ${"the NTP epoch"}
    ${"1970-01-01T00:00:00Z"}           | ${"the Unix epoch"}
    ${"1969-12-31T23:59:59Z"}           | ${"pre-Unix-epoch"}
    ${"2000-01-01T00:00:00Z"}           | ${"round millennium"}
    ${"2024-02-29T00:00:00Z"}           | ${"leap day"}
    ${"2024-03-10T12:34:56.789Z"}       | ${"millisecond fraction"}
    ${"2024-03-10T12:00:00.000000001Z"} | ${"one nanosecond past the second"}
    ${"2024-03-10T12:00:00.999999999Z"} | ${"one nanosecond before the second"}
    ${"2036-02-07T06:28:15Z"}           | ${"the last second of era 0"}
  `(
    "round-trips $value through toNtpTimestamp without losing a nanosecond ($reason)",
    ({ value }) => {
      expect(fromNtpTimestamp(toNtpTimestamp(value))).toBe(value);
    },
  );

  it.each`
    value                     | era   | reason
    ${"2036-02-07T06:28:16Z"} | ${1}  | ${"first second of era 1"}
    ${"1899-12-31T00:00:00Z"} | ${-1} | ${"era -1"}
    ${"1601-01-01T00:00:00Z"} | ${-3} | ${"era -3"}
    ${"2172-03-15T12:56:32Z"} | ${2}  | ${"first second of era 2"}
  `(
    "round-trips $value when given its own era $era ($reason)",
    ({ value, era }) => {
      expect(fromNtpTimestamp(toNtpTimestamp(value), era)).toBe(value);
    },
  );

  it.each`
    value                    | expected                            | reason
    ${18446744073709551615n} | ${"2036-02-07T06:28:16Z"}           | ${"2^64 - 1 rounds onto era 1's first instant"}
    ${18446744073709551614n} | ${"2036-02-07T06:28:16Z"}           | ${"as does the value below it"}
    ${18446744073709551613n} | ${"2036-02-07T06:28:15.999999999Z"} | ${"the highest value still inside era 0"}
    ${18446744073709551611n} | ${"2036-02-07T06:28:15.999999999Z"} | ${"the largest value toNtpTimestamp can actually produce"}
  `(
    "returns $expected for $value at the top of era 0 ($reason)",
    ({ value, expected }) => {
      expect(fromNtpTimestamp(value)).toBe(expected);
    },
  );

  it("cannot reach the rounding-up values from toNtpTimestamp", () => {
    expect(toNtpTimestamp("2036-02-07T06:28:15.999999999Z")).toBe(
      18446744073709551611n,
    );
  });

  it.each`
    value                    | reason
    ${-1n}                   | ${"negative — the timestamp is unsigned"}
    ${18446744073709551616n} | ${"2^64, one past the 64-bit maximum"}
    ${10n ** 30n}            | ${"far beyond 64 bits"}
  `('returns "" for $value ($reason)', ({ value }) => {
    expect(fromNtpTimestamp(value)).toBe("");
  });

  it.each`
    era                         | reason
    ${1000000}                  | ${"far past the representable instant range"}
    ${-1000000}                 | ${"far before the representable instant range"}
    ${1.5}                      | ${"non-integer"}
    ${Number.NaN}               | ${"NaN"}
    ${Number.POSITIVE_INFINITY} | ${"Infinity"}
    ${"0"}                      | ${"string"}
    ${0n}                       | ${"bigint"}
    ${null}                     | ${"null"}
    ${undefined}                | ${"explicitly passed undefined"}
  `('returns "" when era $era is invalid ($reason)', ({ era }) => {
    expect(fromNtpTimestamp(0n, era as unknown as number)).toBe("");
  });

  it.each`
    value
    ${0}
    ${9487534653230284800}
    ${"9487534653230284800"}
    ${null}
    ${undefined}
    ${true}
    ${[]}
    ${{}}
  `('returns "" when $value is non-bigint input', ({ value }) => {
    expect(fromNtpTimestamp(value as unknown as bigint)).toBe("");
  });

  it('returns "" when Temporal.Instant.fromEpochNanoseconds throws', () => {
    mockTemporalInstantFromEpochNanosecondsThrow();

    expect(fromNtpTimestamp(0n)).toBe("");
  });
});
