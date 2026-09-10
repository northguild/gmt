import { sameInstantBattleCases } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { toNtpTimestamp } from "./toNtpTimestamp";

describe("toNtpTimestamp", () => {
  it.each`
    value                               | expected                 | reason
    ${"1900-01-01T00:00:00Z"}           | ${0n}                    | ${"the NTP epoch itself"}
    ${"1970-01-01T00:00:00Z"}           | ${9487534653230284800n}  | ${"seconds field 2208988800, the RFC 5905 Unix delta"}
    ${"1969-12-31T23:59:59Z"}           | ${9487534648935317504n}  | ${"one second before the Unix epoch"}
    ${"2000-01-01T00:00:00Z"}           | ${13553514908850585600n} | ${"seconds field 3155673600"}
    ${"2024-02-29T00:00:00Z"}           | ${16828341572704665600n} | ${"leap day"}
    ${"2024-03-10T12:00:00Z"}           | ${16832237967035596800n} | ${"whole second, zero fraction"}
    ${"2024-03-10T12:34:56.789Z"}       | ${16832246972675778412n} | ${"millisecond fraction"}
    ${"2024-03-10T12:00:00.123456789Z"} | ${16832237967565839671n} | ${"nanosecond fraction"}
    ${"2036-02-07T06:28:15Z"}           | ${18446744069414584320n} | ${"the last second of era 0"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(toNtpTimestamp(value)).toBe(expected);
  });

  it.each`
    value                     | expected                 | era
    ${"2036-02-07T06:28:16Z"} | ${0n}                    | ${1}
    ${"2172-03-15T12:56:32Z"} | ${0n}                    | ${2}
    ${"1899-12-31T00:00:00Z"} | ${18446372988535177216n} | ${-1}
    ${"1601-01-01T00:00:00Z"} | ${14815133583223554048n} | ${-3}
  `(
    "wraps $value into era $era, returning $expected",
    ({ value, expected }) => {
      expect(toNtpTimestamp(value)).toBe(expected);
    },
  );

  it("returns the seconds field in the high 32 bits and the fraction in the low 32", () => {
    const timestamp = toNtpTimestamp("2024-03-10T12:00:00.5Z");

    expect(timestamp >> 32n).toBe(3919060800n);
    expect(timestamp & 0xffffffffn).toBe(2147483648n);
  });

  it.each(sameInstantBattleCases)(
    "returns the same timestamp for 2024-02-29T00:00:00Z expressed in $timeZone",
    ({ value }) => {
      expect(toNtpTimestamp(value)).toBe(16828341572704665600n);
    },
  );

  it.each`
    value                                       | reason
    ${"2024-03-10"}                             | ${"date-only, no offset"}
    ${"2024-03-10T12:00:00"}                    | ${"no offset designator"}
    ${"2024-02-30T12:00:00Z"}                   | ${"day out of range"}
    ${"2016-12-31T23:59:60Z"}                   | ${"leap second"}
    ${"2016-12-31 23:59:60Z"}                   | ${"leap second, space separator"}
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"} | ${"calendar annotation"}
    ${"invalid"}                                | ${"unparseable"}
    ${""}                                       | ${"empty string"}
  `("returns 0n when $value is invalid ($reason)", ({ value }) => {
    expect(toNtpTimestamp(value)).toBe(0n);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${0n}
    ${true}
    ${[]}
    ${{}}
  `("returns 0n when $value is non-string input", ({ value }) => {
    expect(toNtpTimestamp(value as unknown as string)).toBe(0n);
  });

  it("returns 0n when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(toNtpTimestamp("2024-03-10T12:00:00Z")).toBe(0n);
  });
});
