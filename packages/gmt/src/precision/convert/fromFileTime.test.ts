import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import { fromFileTime } from "./fromFileTime";
import { fromNanoseconds } from "./fromNanoseconds";
import { toFileTime } from "./toFileTime";

describe("fromFileTime", () => {
  it.each`
    value                   | expected                             | reason
    ${0n}                   | ${"1601-01-01T00:00:00Z"}            | ${"the FILETIME epoch"}
    ${94354848000000000n}   | ${"1900-01-01T00:00:00Z"}            | ${"pre-Unix"}
    ${116444735990000000n}  | ${"1969-12-31T23:59:59Z"}            | ${"one second before the Unix epoch"}
    ${116444736000000000n}  | ${"1970-01-01T00:00:00Z"}            | ${"the documented Unix delta"}
    ${125911584000000000n}  | ${"2000-01-01T00:00:00Z"}            | ${"round millennium"}
    ${133536384000000000n}  | ${"2024-02-29T00:00:00Z"}            | ${"leap day"}
    ${133545456000000000n}  | ${"2024-03-10T12:00:00Z"}            | ${"whole second"}
    ${133545476967890000n}  | ${"2024-03-10T12:34:56.789Z"}        | ${"millisecond precision"}
    ${133545456001234567n}  | ${"2024-03-10T12:00:00.1234567Z"}    | ${"full 100 ns resolution"}
    ${2650467743999999999n} | ${"9999-12-31T23:59:59.9999999Z"}    | ${"the .NET DateTime maximum"}
    ${9223372036854775807n} | ${"+030828-09-14T02:48:05.4775807Z"} | ${"2^63 − 1, the largest value FileTimeToSystemTime accepts"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(fromFileTime(value)).toBe(expected);
  });

  it.each`
    value                                | reason
    ${"1601-01-01T00:00:00Z"}            | ${"the FILETIME epoch"}
    ${"1970-01-01T00:00:00Z"}            | ${"the Unix epoch"}
    ${"1969-12-31T23:59:59Z"}            | ${"pre-Unix-epoch"}
    ${"2024-02-29T00:00:00Z"}            | ${"leap day"}
    ${"2024-03-10T12:34:56.789Z"}        | ${"millisecond precision"}
    ${"2024-03-10T12:00:00.1234567Z"}    | ${"exactly on the 100 ns grid"}
    ${"+030828-09-14T02:48:05.4775807Z"} | ${"2^63 − 1, the largest convertible FILETIME"}
  `("round-trips $value through toFileTime ($reason)", ({ value }) => {
    expect(fromFileTime(toFileTime(value))).toBe(value);
  });

  it("round-trips a sub-100 ns instant only as far as the 100 ns grid", () => {
    expect(fromFileTime(toFileTime("2024-03-10T12:00:00.123456789Z"))).toBe(
      "2024-03-10T12:00:00.1234567Z",
    );
  });

  it.each`
    value                    | reason
    ${-1n}                   | ${"negative — FILETIME is a pair of unsigned DWORDs"}
    ${-116444736000000000n}  | ${"far negative"}
    ${9223372036854775808n}  | ${"2^63 — FileTimeToSystemTime requires less than 0x8000000000000000"}
    ${15273248544000000000n} | ${"+050000-01-01, between 2^63 and 2^64"}
    ${18446744073709551615n} | ${"2^64 − 1 — SetFileTime's 0xFFFFFFFF/0xFFFFFFFF do-not-modify marker"}
    ${18446744073709551616n} | ${"2^64, past the struct's two DWORDs"}
    ${10n ** 30n}            | ${"far beyond 64 bits"}
  `('returns "" for $value ($reason)', ({ value }) => {
    expect(fromFileTime(value)).toBe("");
  });

  it.each`
    value                    | expected
    ${9223372036854775808n}  | ${"+030828-09-14T02:48:05.4775808Z"}
    ${18446744073709551615n} | ${"+060056-05-28T05:36:10.9551615Z"}
  `(
    "decodes $value as $expected through fromNanoseconds, the unsigned-arithmetic compatibility path",
    ({ value, expected }) => {
      expect(fromNanoseconds((value - 116444736000000000n) * 100n)).toBe(
        expected,
      );
    },
  );

  it.each`
    value
    ${0}
    ${116444736000000000}
    ${"116444736000000000"}
    ${null}
    ${undefined}
    ${true}
    ${[]}
    ${{}}
  `('returns "" when $value is non-bigint input', ({ value }) => {
    expect(fromFileTime(value as unknown as bigint)).toBe("");
  });

  it('returns "" when Temporal.Instant.fromEpochNanoseconds throws', () => {
    mockTemporalInstantFromEpochNanosecondsThrow();

    expect(fromFileTime(116444736000000000n)).toBe("");
  });
});
