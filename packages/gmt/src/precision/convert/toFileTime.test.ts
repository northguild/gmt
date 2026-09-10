import { sameInstantBattleCases } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { toFileTime } from "./toFileTime";

describe("toFileTime", () => {
  it.each`
    value                         | expected                | reason
    ${"1601-01-01T00:00:00Z"}     | ${0n}                   | ${"the FILETIME epoch itself"}
    ${"1900-01-01T00:00:00Z"}     | ${94354848000000000n}   | ${"pre-Unix"}
    ${"1969-12-31T23:59:59Z"}     | ${116444735990000000n}  | ${"one second before the Unix epoch"}
    ${"1970-01-01T00:00:00Z"}     | ${116444736000000000n}  | ${"the documented Unix delta"}
    ${"2000-01-01T00:00:00Z"}     | ${125911584000000000n}  | ${"round millennium"}
    ${"2024-02-29T00:00:00Z"}     | ${133536384000000000n}  | ${"leap day"}
    ${"2024-03-10T12:00:00Z"}     | ${133545456000000000n}  | ${"whole second"}
    ${"2024-03-10T12:34:56.789Z"} | ${133545476967890000n}  | ${"millisecond precision"}
    ${"9999-12-31T23:59:59.999Z"} | ${2650467743999990000n} | ${"the .NET DateTime maximum"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(toFileTime(value)).toBe(expected);
  });

  it("returns 116444736000000000n at the Unix epoch, the constant every Win32 bridge carries", () => {
    expect(toFileTime("1970-01-01T00:00:00Z")).toBe(116444736000000000n);
  });

  it.each`
    value                               | expected               | reason
    ${"2024-03-10T12:00:00.1234567Z"}   | ${133545456001234567n} | ${"exactly on the 100 ns grid"}
    ${"2024-03-10T12:00:00.123456789Z"} | ${133545456001234567n} | ${"sub-100 ns digits floor away"}
    ${"1969-12-31T23:59:59.999999999Z"} | ${116444735999999999n} | ${"floors toward negative infinity before the epoch"}
  `(
    "truncates $value to the 100 ns grid as $expected ($reason)",
    ({ value, expected }) => {
      expect(toFileTime(value)).toBe(expected);
    },
  );

  it.each(sameInstantBattleCases)(
    "returns the same tick count for 2024-02-29T00:00:00Z expressed in $timeZone",
    ({ value }) => {
      expect(toFileTime(value)).toBe(133536384000000000n);
    },
  );

  it.each`
    value                                | expected                 | reason
    ${"+060056-05-28T05:36:10.9551615Z"} | ${18446744073709551615n} | ${"the unsigned 64-bit maximum"}
  `(
    "returns $expected at the FILETIME boundary $value ($reason)",
    ({ value, expected }) => {
      expect(toFileTime(value)).toBe(expected);
    },
  );

  it.each`
    value                                | reason
    ${"1600-12-31T23:59:59.9999999Z"}    | ${"one tick before the FILETIME epoch"}
    ${"1600-12-31T23:59:59Z"}            | ${"before the FILETIME epoch"}
    ${"1066-10-14T00:00:00Z"}            | ${"centuries before the FILETIME epoch"}
    ${"+060056-05-28T05:36:10.9551616Z"} | ${"one tick past the unsigned 64-bit maximum"}
    ${"+060056-05-28T05:36:11Z"}         | ${"past the unsigned 64-bit maximum"}
    ${"+275760-09-13T00:00:00Z"}         | ${"the largest representable instant"}
  `(
    "returns 0n for $value, which FILETIME cannot represent ($reason)",
    ({ value }) => {
      expect(toFileTime(value)).toBe(0n);
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
    expect(toFileTime(value)).toBe(0n);
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
    expect(toFileTime(value as unknown as string)).toBe(0n);
  });

  it("returns 0n when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(toFileTime("2024-03-10T12:00:00Z")).toBe(0n);
  });
});
